/**
 * Adapters that wrap raw Discord interaction JSON + REST client to provide
 * the same API surface that our handler functions expect from discord.js types.
 *
 * Used in HTTP interactions mode so existing handlers can be reused without
 * modification. Type assertions (as unknown as ...) are used at call sites.
 */

import { Routes } from 'discord.js';
import type { REST } from 'discord.js';
import type {
  APIApplicationCommandInteractionDataOption,
  APIInteractionResponseCallbackData,
} from 'discord-api-types/v10';
import { ApplicationCommandOptionType } from 'discord-api-types/v10';

// ---------------------------------------------------------------------------
// Payload serialization — converts discord.js builders to API JSON
// ---------------------------------------------------------------------------

interface BuilderLike {
  toJSON(): unknown;
}

function isBuilder(obj: unknown): obj is BuilderLike {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'toJSON' in obj &&
    typeof (obj as BuilderLike).toJSON === 'function'
  );
}

/** Serialize a reply/edit payload so EmbedBuilder and ActionRowBuilder are converted to JSON. */
export function serializePayload(
  data: Record<string, unknown>
): APIInteractionResponseCallbackData {
  const result: Record<string, unknown> = {};

  if (data.embeds && Array.isArray(data.embeds)) {
    result.embeds = data.embeds.map((e: unknown) => (isBuilder(e) ? e.toJSON() : e));
  }

  if (data.components && Array.isArray(data.components)) {
    result.components = data.components.map((c: unknown) => (isBuilder(c) ? c.toJSON() : c));
  }

  if (data.content !== undefined) result.content = data.content;
  if (data.flags !== undefined) result.flags = data.flags;

  return result as APIInteractionResponseCallbackData;
}

// ---------------------------------------------------------------------------
// HttpMessage — wraps a Discord message for .id and .edit()
// ---------------------------------------------------------------------------

export class HttpMessage {
  readonly id: string;

  constructor(
    private readonly rest: REST,
    private readonly channelId: string,
    id: string
  ) {
    this.id = id;
  }

  async edit(data: Record<string, unknown>): Promise<HttpMessage> {
    await this.rest.patch(Routes.channelMessage(this.channelId, this.id), {
      body: serializePayload(data),
    });
    return this;
  }
}

// ---------------------------------------------------------------------------
// HttpTextChannel — wraps channel operations (send, messages.fetch)
// ---------------------------------------------------------------------------

export class HttpTextChannel {
  readonly messages: {
    fetch: (id: string) => Promise<HttpMessage>;
  };

  constructor(
    private readonly rest: REST,
    readonly id: string
  ) {
    const channelId = id;
    const restRef = rest;

    this.messages = {
      async fetch(messageId: string): Promise<HttpMessage> {
        await restRef.get(Routes.channelMessage(channelId, messageId));
        return new HttpMessage(restRef, channelId, messageId);
      },
    };
  }

  async send(data: Record<string, unknown>): Promise<HttpMessage> {
    const result = (await this.rest.post(Routes.channelMessages(this.id), {
      body: serializePayload(data),
    })) as { id: string };
    return new HttpMessage(this.rest, this.id, result.id);
  }
}

// ---------------------------------------------------------------------------
// HttpCommandOptions — parses raw Discord option arrays
// ---------------------------------------------------------------------------

export class HttpCommandOptions {
  private readonly optionMap = new Map<string, unknown>();
  private subcommandName: string | null = null;

  constructor(rawOptions?: APIApplicationCommandInteractionDataOption[]) {
    if (!rawOptions) return;

    for (const opt of rawOptions) {
      if (opt.type === ApplicationCommandOptionType.Subcommand) {
        // Subcommand: store its name, and flatten its nested options
        this.subcommandName = opt.name;
        if ('options' in opt && opt.options) {
          for (const sub of opt.options) {
            this.optionMap.set(sub.name, 'value' in sub ? sub.value : null);
          }
        }
      } else if ('value' in opt) {
        this.optionMap.set(opt.name, opt.value);
      }
    }
  }

  getSubcommand(): string {
    if (!this.subcommandName) {
      throw new Error('No subcommand found');
    }
    return this.subcommandName;
  }

  getString(name: string, _required?: boolean): string | null {
    const val = this.optionMap.get(name);
    return typeof val === 'string' ? val : null;
  }

  getBoolean(name: string): boolean | null {
    const val = this.optionMap.get(name);
    return typeof val === 'boolean' ? val : null;
  }

  getInteger(name: string, _required?: boolean): number | null {
    const val = this.optionMap.get(name);
    return typeof val === 'number' ? val : null;
  }
}

// ---------------------------------------------------------------------------
// User formatting helper
// ---------------------------------------------------------------------------

function formatUserTag(user: { username: string; discriminator?: string }): string {
  if (user.discriminator && user.discriminator !== '0') {
    return `${user.username}#${user.discriminator}`;
  }
  return user.username;
}

// ---------------------------------------------------------------------------
// Factory: createCommandInteraction
// ---------------------------------------------------------------------------

interface RawCommandInteractionData {
  data: {
    name: string;
    options?: APIApplicationCommandInteractionDataOption[];
  };
  member?: { user: { id: string; username: string; discriminator?: string } };
  user?: { id: string; username: string; discriminator?: string };
  channel_id: string;
  guild_id?: string;
}

/**
 * Create an adapter object that matches the ChatInputCommandInteraction API
 * surface used by our handlers. Use with type assertion at call site:
 *   as unknown as ChatInputCommandInteraction
 */
export function createCommandInteraction(
  rest: REST,
  appId: string,
  token: string,
  data: RawCommandInteractionData
): Record<string, unknown> {
  const rawUser = data.member?.user ?? data.user;
  const user = {
    id: rawUser?.id ?? '',
    tag: rawUser ? formatUserTag(rawUser) : '',
  };

  const channelId = data.channel_id;
  const channel = new HttpTextChannel(rest, channelId);
  const options = new HttpCommandOptions(data.data.options);

  return {
    user,
    channelId,
    guildId: data.guild_id ?? null,
    commandName: data.data.name,
    options,
    channel,

    async editReply(replyData: Record<string, unknown>): Promise<void> {
      await rest.patch(Routes.webhookMessage(appId, token, '@original'), {
        body: serializePayload(replyData),
      });
    },

    async reply(replyData: Record<string, unknown>): Promise<void> {
      // In HTTP mode we always defer, so reply() = editReply()
      await rest.patch(Routes.webhookMessage(appId, token, '@original'), {
        body: serializePayload(replyData),
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Factory: createButtonInteraction
// ---------------------------------------------------------------------------

interface RawButtonInteractionData {
  data: { custom_id: string };
  member?: { user: { id: string; username: string; discriminator?: string } };
  user?: { id: string; username: string; discriminator?: string };
  channel_id: string;
  guild_id?: string;
}

/**
 * Create an adapter object that matches the ButtonInteraction API surface
 * used by our handlers. Use with type assertion at call site:
 *   as unknown as ButtonInteraction
 */
export function createButtonInteraction(
  rest: REST,
  appId: string,
  token: string,
  data: RawButtonInteractionData
): Record<string, unknown> {
  const rawUser = data.member?.user ?? data.user;
  const user = {
    id: rawUser?.id ?? '',
    tag: rawUser ? formatUserTag(rawUser) : '',
  };

  const channelId = data.channel_id;
  const channel = new HttpTextChannel(rest, channelId);

  return {
    user,
    channelId,
    guildId: data.guild_id ?? null,
    customId: data.data.custom_id,
    channel,

    async editReply(replyData: Record<string, unknown>): Promise<void> {
      await rest.patch(Routes.webhookMessage(appId, token, '@original'), {
        body: serializePayload(replyData),
      });
    },

    async followUp(replyData: Record<string, unknown>): Promise<void> {
      await rest.post(Routes.webhook(appId, token), {
        body: serializePayload(replyData),
      });
    },
  };
}
