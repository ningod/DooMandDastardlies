import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplicationCommandOptionType } from 'discord-api-types/v10';
import {
  HttpCommandOptions,
  HttpTextChannel,
  HttpMessage,
  serializePayload,
  createCommandInteraction,
  createButtonInteraction,
} from '../src/http/adapter.js';

// ---------------------------------------------------------------------------
// Mock REST client
// ---------------------------------------------------------------------------

function createMockRest() {
  return {
    get: vi.fn().mockResolvedValue({ id: 'fetched-msg-123' }),
    post: vi.fn().mockResolvedValue({ id: 'sent-msg-456' }),
    patch: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  };
}

// ---------------------------------------------------------------------------
// serializePayload
// ---------------------------------------------------------------------------

describe('serializePayload', () => {
  it('passes plain objects through', () => {
    const data = {
      content: 'hello',
      embeds: [{ title: 'Test' }],
      flags: 64,
    };
    const result = serializePayload(data);
    expect(result).toEqual({
      content: 'hello',
      embeds: [{ title: 'Test' }],
      flags: 64,
    });
  });

  it('calls .toJSON() on embed builders', () => {
    const mockEmbed = {
      toJSON: () => ({ title: 'Built Embed', color: 0x5865f2 }),
    };
    const result = serializePayload({ embeds: [mockEmbed] });
    expect(result.embeds).toEqual([{ title: 'Built Embed', color: 0x5865f2 }]);
  });

  it('calls .toJSON() on component builders', () => {
    const mockRow = {
      toJSON: () => ({
        type: 1,
        components: [{ type: 2, label: 'Click' }],
      }),
    };
    const result = serializePayload({ components: [mockRow] });
    expect(result.components).toEqual([{ type: 1, components: [{ type: 2, label: 'Click' }] }]);
  });

  it('handles mixed builders and plain objects', () => {
    const mockEmbed = { toJSON: () => ({ title: 'Builder' }) };
    const plainEmbed = { title: 'Plain' };
    const result = serializePayload({ embeds: [mockEmbed, plainEmbed] });
    expect(result.embeds).toEqual([{ title: 'Builder' }, { title: 'Plain' }]);
  });
});

// ---------------------------------------------------------------------------
// HttpCommandOptions
// ---------------------------------------------------------------------------

describe('HttpCommandOptions', () => {
  it('parses top-level options', () => {
    const opts = new HttpCommandOptions([
      {
        name: 'dice',
        type: ApplicationCommandOptionType.String,
        value: '2d6',
      },
      {
        name: 'secret',
        type: ApplicationCommandOptionType.Boolean,
        value: true,
      },
    ]);
    expect(opts.getString('dice')).toBe('2d6');
    expect(opts.getBoolean('secret')).toBe(true);
  });

  it('parses subcommand with nested options', () => {
    const opts = new HttpCommandOptions([
      {
        name: 'start',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'interval',
            type: ApplicationCommandOptionType.Integer,
            value: 5,
          },
          {
            name: 'name',
            type: ApplicationCommandOptionType.String,
            value: 'Combat',
          },
        ],
      },
    ]);
    expect(opts.getSubcommand()).toBe('start');
    expect(opts.getInteger('interval')).toBe(5);
    expect(opts.getString('name')).toBe('Combat');
  });

  it('returns null for missing options', () => {
    const opts = new HttpCommandOptions([]);
    expect(opts.getString('nonexistent')).toBeNull();
    expect(opts.getBoolean('nonexistent')).toBeNull();
    expect(opts.getInteger('nonexistent')).toBeNull();
  });

  it('throws for missing subcommand', () => {
    const opts = new HttpCommandOptions([]);
    expect(() => opts.getSubcommand()).toThrow('No subcommand found');
  });

  it('handles empty constructor', () => {
    const opts = new HttpCommandOptions();
    expect(opts.getString('any')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HttpMessage
// ---------------------------------------------------------------------------

describe('HttpMessage', () => {
  it('stores the message id', () => {
    const rest = createMockRest();
    const msg = new HttpMessage(rest as never, 'ch-1', 'msg-1');
    expect(msg.id).toBe('msg-1');
  });

  it('calls REST PATCH on edit()', async () => {
    const rest = createMockRest();
    const msg = new HttpMessage(rest as never, 'ch-1', 'msg-1');
    await msg.edit({ content: 'updated' });

    expect(rest.patch).toHaveBeenCalledOnce();
    const [route, options] = rest.patch.mock.calls[0];
    expect(route).toContain('channels/ch-1/messages/msg-1');
    expect(options.body).toEqual({ content: 'updated' });
  });
});

// ---------------------------------------------------------------------------
// HttpTextChannel
// ---------------------------------------------------------------------------

describe('HttpTextChannel', () => {
  let rest: ReturnType<typeof createMockRest>;
  let channel: HttpTextChannel;

  beforeEach(() => {
    rest = createMockRest();
    channel = new HttpTextChannel(rest as never, 'ch-100');
  });

  it("has 'send' property for 'send' in channel check", () => {
    expect('send' in channel).toBe(true);
  });

  it('send() calls REST POST and returns HttpMessage', async () => {
    const msg = await channel.send({ content: 'hello' });

    expect(rest.post).toHaveBeenCalledOnce();
    const [route] = rest.post.mock.calls[0];
    expect(route).toContain('channels/ch-100/messages');
    expect(msg.id).toBe('sent-msg-456');
  });

  it('messages.fetch() calls REST GET and returns HttpMessage', async () => {
    const msg = await channel.messages.fetch('target-msg');

    expect(rest.get).toHaveBeenCalledOnce();
    const [route] = rest.get.mock.calls[0];
    expect(route).toContain('channels/ch-100/messages/target-msg');
    expect(msg.id).toBe('target-msg');
  });

  it('fetched message has working edit()', async () => {
    const msg = await channel.messages.fetch('target-msg');
    await msg.edit({ content: 'edited' });

    expect(rest.patch).toHaveBeenCalledOnce();
    const [route] = rest.patch.mock.calls[0];
    expect(route).toContain('channels/ch-100/messages/target-msg');
  });
});

// ---------------------------------------------------------------------------
// createCommandInteraction
// ---------------------------------------------------------------------------

describe('createCommandInteraction', () => {
  it('provides correct user, channelId, guildId, commandName', () => {
    const rest = createMockRest();
    const adapter = createCommandInteraction(rest as never, 'app-1', 'tok-1', {
      data: { name: 'roll' },
      member: {
        user: { id: 'user-42', username: 'TestUser', discriminator: '0' },
      },
      channel_id: 'ch-99',
      guild_id: 'guild-7',
    });

    expect(adapter.user).toEqual({ id: 'user-42', tag: 'TestUser' });
    expect(adapter.channelId).toBe('ch-99');
    expect(adapter.guildId).toBe('guild-7');
    expect(adapter.commandName).toBe('roll');
  });

  it('formats user tag with discriminator', () => {
    const rest = createMockRest();
    const adapter = createCommandInteraction(rest as never, 'app-1', 'tok-1', {
      data: { name: 'roll' },
      member: {
        user: {
          id: 'user-42',
          username: 'TestUser',
          discriminator: '1234',
        },
      },
      channel_id: 'ch-99',
    });

    expect(adapter.user).toEqual({ id: 'user-42', tag: 'TestUser#1234' });
  });

  it('uses DM user when no member', () => {
    const rest = createMockRest();
    const adapter = createCommandInteraction(rest as never, 'app-1', 'tok-1', {
      data: { name: 'help' },
      user: { id: 'user-dm', username: 'DMUser' },
      channel_id: 'ch-dm',
    });

    expect(adapter.user).toEqual({ id: 'user-dm', tag: 'DMUser' });
    expect(adapter.guildId).toBeNull();
  });

  it('editReply() calls REST PATCH webhook endpoint', async () => {
    const rest = createMockRest();
    const adapter = createCommandInteraction(rest as never, 'app-1', 'tok-1', {
      data: { name: 'roll' },
      member: { user: { id: 'u', username: 'U' } },
      channel_id: 'ch-1',
    });

    const editReply = adapter.editReply as (d: Record<string, unknown>) => Promise<void>;
    await editReply({ content: 'result' });

    expect(rest.patch).toHaveBeenCalledOnce();
    const [route] = rest.patch.mock.calls[0];
    expect(route).toContain('webhooks/app-1/tok-1/messages');
  });

  it('reply() calls the same endpoint as editReply()', async () => {
    const rest = createMockRest();
    const adapter = createCommandInteraction(rest as never, 'app-1', 'tok-1', {
      data: { name: 'help' },
      member: { user: { id: 'u', username: 'U' } },
      channel_id: 'ch-1',
    });

    const reply = adapter.reply as (d: Record<string, unknown>) => Promise<void>;
    await reply({ content: 'help text' });

    expect(rest.patch).toHaveBeenCalledOnce();
  });

  it('provides a channel with send()', async () => {
    const rest = createMockRest();
    const adapter = createCommandInteraction(rest as never, 'app-1', 'tok-1', {
      data: { name: 'secret' },
      member: { user: { id: 'u', username: 'U' } },
      channel_id: 'ch-55',
    });

    const channel = adapter.channel as HttpTextChannel;
    expect('send' in channel).toBe(true);

    const msg = await channel.send({ content: 'announcement' });
    expect(msg.id).toBe('sent-msg-456');
    expect(rest.post).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// createButtonInteraction
// ---------------------------------------------------------------------------

describe('createButtonInteraction', () => {
  it('provides correct customId, user, channelId', () => {
    const rest = createMockRest();
    const adapter = createButtonInteraction(rest as never, 'app-1', 'tok-1', {
      data: { custom_id: 'reveal:abc-123' },
      member: { user: { id: 'user-7', username: 'Clicker' } },
      channel_id: 'ch-88',
    });

    expect(adapter.customId).toBe('reveal:abc-123');
    expect(adapter.user).toEqual({ id: 'user-7', tag: 'Clicker' });
    expect(adapter.channelId).toBe('ch-88');
  });

  it('editReply() calls REST PATCH webhook endpoint', async () => {
    const rest = createMockRest();
    const adapter = createButtonInteraction(rest as never, 'app-1', 'tok-2', {
      data: { custom_id: 'tstop:5' },
      member: { user: { id: 'u', username: 'U' } },
      channel_id: 'ch-1',
    });

    const editReply = adapter.editReply as (d: Record<string, unknown>) => Promise<void>;
    await editReply({ content: 'stopped' });

    expect(rest.patch).toHaveBeenCalledOnce();
    const [route] = rest.patch.mock.calls[0];
    expect(route).toContain('webhooks/app-1/tok-2/messages');
  });

  it('provides a channel with messages.fetch()', async () => {
    const rest = createMockRest();
    const adapter = createButtonInteraction(rest as never, 'app-1', 'tok-1', {
      data: { custom_id: 'reveal:xyz' },
      member: { user: { id: 'u', username: 'U' } },
      channel_id: 'ch-77',
    });

    const channel = adapter.channel as HttpTextChannel;
    const msg = await channel.messages.fetch('public-msg-id');
    expect(msg.id).toBe('public-msg-id');
    expect(rest.get).toHaveBeenCalledOnce();
  });

  it('provides guildId from raw data', () => {
    const rest = createMockRest();
    const adapter = createButtonInteraction(rest as never, 'app-1', 'tok-1', {
      data: { custom_id: 'trestart:1:5:0:Combat' },
      member: { user: { id: 'u', username: 'U' } },
      channel_id: 'ch-1',
      guild_id: 'guild-42',
    });

    expect(adapter.guildId).toBe('guild-42');
  });

  it('guildId is null when missing', () => {
    const rest = createMockRest();
    const adapter = createButtonInteraction(rest as never, 'app-1', 'tok-1', {
      data: { custom_id: 'reveal:abc' },
      member: { user: { id: 'u', username: 'U' } },
      channel_id: 'ch-1',
    });

    expect(adapter.guildId).toBeNull();
  });

  it('followUp() calls REST POST webhook endpoint', async () => {
    const rest = createMockRest();
    const adapter = createButtonInteraction(rest as never, 'app-1', 'tok-3', {
      data: { custom_id: 'reveal:abc' },
      member: { user: { id: 'u', username: 'U' } },
      channel_id: 'ch-1',
    });

    const followUp = adapter.followUp as (d: Record<string, unknown>) => Promise<void>;
    await followUp({ content: 'error message' });

    expect(rest.post).toHaveBeenCalledOnce();
    const [route] = rest.post.mock.calls[0];
    expect(route).toContain('webhooks/app-1/tok-3');
  });
});
