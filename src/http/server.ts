/**
 * HTTP interactions server for Discord.
 *
 * Receives Discord interaction POSTs, verifies Ed25519 signatures,
 * sends deferred responses within the 3-second deadline, then
 * processes handlers asynchronously using REST API for replies.
 *
 * Endpoints:
 *   POST /interactions — Discord interaction handler
 *   GET  /health       — Health check
 */

import http from 'node:http';
import { REST } from 'discord.js';
import {
  InteractionType,
  InteractionResponseType,
  MessageFlags,
  ApplicationCommandOptionType,
} from 'discord-api-types/v10';
import type {
  APIApplicationCommandInteraction,
  APIMessageComponentInteraction,
  APIApplicationCommandInteractionDataOption,
} from 'discord-api-types/v10';
import type { ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import { verifyDiscordSignature } from './verify.js';
import { createCommandInteraction, createButtonInteraction } from './adapter.js';
import { handleRollCommand, ROLL_COMMAND_NAMES } from '../commands/roll.js';
import { handleHelpCommand } from '../commands/help.js';
import { handleTimerCommand } from '../commands/timer.js';
import { handlePrivacyCommand } from '../commands/privacy.js';
import { handleButton } from '../interactions/buttons.js';
import { handleTimerButton } from '../interactions/timer-buttons.js';
import type { IRollStore, ITimerStore } from '../lib/store-interface.js';
import type { RateLimiter } from '../lib/ratelimit.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Secret detection — mirrors defer logic from gateway mode (index.ts)
// ---------------------------------------------------------------------------

/** Commands where secret defaults to true. */
const SECRET_DEFAULT_COMMANDS = new Set(['secret', 's']);

/**
 * Determine whether a roll command should be treated as secret from raw options.
 */
function isSecretRoll(
  commandName: string,
  options?: APIApplicationCommandInteractionDataOption[]
): boolean {
  const secretDefault = SECRET_DEFAULT_COMMANDS.has(commandName);

  if (options) {
    for (const opt of options) {
      if (
        opt.name === 'secret' &&
        opt.type === ApplicationCommandOptionType.Boolean &&
        'value' in opt
      ) {
        return opt.value;
      }
    }
  }

  return secretDefault;
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/** Read the full body from an incoming request. */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString());
    });
    req.on('error', reject);
  });
}

/** Send a JSON response. */
function jsonResponse(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

// ---------------------------------------------------------------------------
// Interaction handler
// ---------------------------------------------------------------------------

function createInteractionHandler(
  rest: REST,
  appId: string,
  publicKey: string,
  rollStore: IRollStore,
  timerStore: ITimerStore,
  limiter: RateLimiter
): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> {
  return async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
      jsonResponse(res, 405, { error: 'Method not allowed' });
      return;
    }

    // Read and verify signature
    const rawBody = await readBody(req);
    const signature = req.headers['x-signature-ed25519'] as string | undefined;
    const timestamp = req.headers['x-signature-timestamp'] as string | undefined;

    if (!signature || !timestamp) {
      jsonResponse(res, 401, { error: 'Missing signature headers' });
      return;
    }

    const valid = await verifyDiscordSignature(rawBody, signature, timestamp, publicKey);
    if (!valid) {
      jsonResponse(res, 401, { error: 'Invalid signature' });
      return;
    }

    // Parse the interaction
    const interaction = JSON.parse(rawBody) as { type: InteractionType };
    const type = interaction.type;

    // PING → PONG
    if (type === InteractionType.Ping) {
      jsonResponse(res, 200, { type: InteractionResponseType.Pong });
      return;
    }

    // APPLICATION_COMMAND
    if (type === InteractionType.ApplicationCommand) {
      const data = interaction as unknown as APIApplicationCommandInteraction;
      const commandName = data.data.name;
      const token = data.token;

      // Determine defer flags
      let deferFlags: number | undefined;

      if (ROLL_COMMAND_NAMES.has(commandName)) {
        const secret = isSecretRoll(
          commandName,
          'options' in data.data ? data.data.options : undefined
        );
        deferFlags = secret ? MessageFlags.Ephemeral : undefined;
      } else if (commandName === 'timer') {
        deferFlags = MessageFlags.Ephemeral;
      }
      // /help — no ephemeral flag

      // Send deferred response immediately
      const deferBody: Record<string, unknown> = {
        type: InteractionResponseType.DeferredChannelMessageWithSource,
      };
      if (deferFlags) {
        deferBody.data = { flags: deferFlags };
      }
      jsonResponse(res, 200, deferBody);

      // Process asynchronously
      void handleCommand(rest, appId, token, data, commandName, rollStore, timerStore, limiter);
      return;
    }

    // MESSAGE_COMPONENT (buttons)
    if (type === InteractionType.MessageComponent) {
      const data = interaction as unknown as APIMessageComponentInteraction;
      const customId = data.data.custom_id;
      const token = data.token;

      // Determine defer type and flags
      let responseType: number;
      let deferFlags: number | undefined;

      if (customId.startsWith('reveal:')) {
        // Reveal button — defer update (no new message)
        responseType = InteractionResponseType.DeferredMessageUpdate;
      } else if (customId.startsWith('tstop:') || customId.startsWith('trestart:')) {
        // Timer buttons — ephemeral deferred reply
        responseType = InteractionResponseType.DeferredChannelMessageWithSource;
        deferFlags = MessageFlags.Ephemeral;
      } else {
        // Unknown button — still defer to avoid timeout
        responseType = InteractionResponseType.DeferredChannelMessageWithSource;
        deferFlags = MessageFlags.Ephemeral;
      }

      const deferBody: Record<string, unknown> = { type: responseType };
      if (deferFlags) {
        deferBody.data = { flags: deferFlags };
      }
      jsonResponse(res, 200, deferBody);

      // Process asynchronously
      void handleComponent(rest, appId, token, data, customId, rollStore, timerStore, limiter);
      return;
    }

    // Unknown interaction type
    jsonResponse(res, 400, { error: 'Unknown interaction type' });
  };
}

// ---------------------------------------------------------------------------
// Async command processing
// ---------------------------------------------------------------------------

async function handleCommand(
  rest: REST,
  appId: string,
  token: string,
  data: APIApplicationCommandInteraction,
  commandName: string,
  rollStore: IRollStore,
  timerStore: ITimerStore,
  limiter: RateLimiter
): Promise<void> {
  try {
    const adapter = createCommandInteraction(rest, appId, token, data as never);
    const interaction = adapter as unknown as ChatInputCommandInteraction;

    logger.info('http-interaction-received', {
      type: 'slash-command',
      command: commandName,
      userId: (adapter.user as { id: string }).id,
      channelId: adapter.channelId as string,
    });

    if (ROLL_COMMAND_NAMES.has(commandName)) {
      await handleRollCommand(interaction, rollStore, limiter);
    } else if (commandName === 'help') {
      await handleHelpCommand(interaction);
    } else if (commandName === 'timer') {
      await handleTimerCommand(interaction, timerStore, limiter);
    } else if (commandName === 'privacy') {
      await handlePrivacyCommand(interaction);
    }
  } catch (err) {
    logger.error('http-command-error', {
      command: commandName,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Async component processing
// ---------------------------------------------------------------------------

async function handleComponent(
  rest: REST,
  appId: string,
  token: string,
  data: APIMessageComponentInteraction,
  customId: string,
  rollStore: IRollStore,
  timerStore: ITimerStore,
  limiter: RateLimiter
): Promise<void> {
  try {
    const adapter = createButtonInteraction(rest, appId, token, data as never);
    const interaction = adapter as unknown as ButtonInteraction;

    logger.info('http-interaction-received', {
      type: 'button',
      customId,
      userId: (adapter.user as { id: string }).id,
      channelId: adapter.channelId as string,
    });

    if (customId.startsWith('reveal:')) {
      await handleButton(interaction, rollStore);
    } else if (customId.startsWith('tstop:') || customId.startsWith('trestart:')) {
      await handleTimerButton(interaction, timerStore, limiter);
    }
  } catch (err) {
    logger.error('http-component-error', {
      customId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

/**
 * Start the HTTP interactions server.
 *
 * Reads configuration from environment variables:
 * - DISCORD_PUBLIC_KEY — Required for signature verification
 * - DISCORD_BOT_TOKEN — Required for REST API calls
 * - DISCORD_CLIENT_ID — Required for webhook endpoints
 * - PORT — Server port (default: 3000)
 */
export function startHttpServer(
  rollStore: IRollStore,
  timerStore: ITimerStore,
  limiter: RateLimiter
): http.Server {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  const token = process.env.DISCORD_BOT_TOKEN;
  const appId = process.env.DISCORD_CLIENT_ID;
  const port = parseInt(process.env.PORT ?? '3000', 10);

  if (!publicKey) {
    logger.error('missing-public-key', {
      message: 'DISCORD_PUBLIC_KEY environment variable is required for HTTP mode.',
    });
    process.exit(1);
  }

  if (!token) {
    logger.error('missing-token', {
      message: 'DISCORD_BOT_TOKEN environment variable is required for HTTP mode.',
    });
    process.exit(1);
  }

  if (!appId) {
    logger.error('missing-client-id', {
      message: 'DISCORD_CLIENT_ID environment variable is required for HTTP mode.',
    });
    process.exit(1);
  }

  // Create REST client for outbound API calls
  const rest = new REST({ version: '10' }).setToken(token);

  const handleInteraction = createInteractionHandler(
    rest,
    appId,
    publicKey,
    rollStore,
    timerStore,
    limiter
  );

  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

        if (url.pathname === '/interactions') {
          await handleInteraction(req, res);
          return;
        }

        if (url.pathname === '/health' && req.method === 'GET') {
          jsonResponse(res, 200, { status: 'ok', mode: 'http' });
          return;
        }

        jsonResponse(res, 404, { error: 'Not found' });
      } catch (err) {
        logger.error('http-server-error', {
          error: err instanceof Error ? err.message : String(err),
        });
        if (!res.headersSent) {
          jsonResponse(res, 500, { error: 'Internal server error' });
        }
      }
    })();
  });

  server.listen(port, () => {
    logger.info('http-server-started', {
      port,
      mode: 'http',
      endpoints: ['/interactions', '/health'],
    });
  });

  return server;
}
