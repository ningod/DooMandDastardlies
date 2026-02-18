import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;

// ---------------------------------------------------------------------------
// Mock all handler modules so we test ONLY server routing / defer logic
// ---------------------------------------------------------------------------

vi.mock('../src/commands/roll.js', () => ({
  handleRollCommand: vi.fn().mockResolvedValue(undefined),
  ROLL_COMMAND_NAMES: new Set(['roll', 'r', 'secret', 's']),
}));

vi.mock('../src/commands/help.js', () => ({
  handleHelpCommand: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/commands/timer.js', () => ({
  handleTimerCommand: vi.fn().mockResolvedValue(undefined),
  buildStopButton: vi.fn(),
  buildRestartButton: vi.fn(),
}));

vi.mock('../src/interactions/buttons.js', () => ({
  handleButton: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/interactions/timer-buttons.js', () => ({
  handleTimerButton: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/lib/timer-embeds.js', () => ({
  buildTimerTriggerEmbed: vi.fn(),
  buildTimerCompleteEmbed: vi.fn(),
}));

vi.mock('discord.js', () => {
  class MockREST {
    setToken() {
      return this;
    }
  }
  return { REST: MockREST };
});

// ---------------------------------------------------------------------------
// Ed25519 test key pair
// ---------------------------------------------------------------------------

let privateKey: CryptoKey;
let publicKeyHex: string;

async function generateTestKeyPair(): Promise<void> {
  const keyPair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const rawPublicKey = await subtle.exportKey('raw', keyPair.publicKey as CryptoKey);
  publicKeyHex = Buffer.from(rawPublicKey).toString('hex');
  privateKey = keyPair.privateKey as CryptoKey;
}

async function signBody(body: string, timestamp: string): Promise<string> {
  const message = Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]);
  const signature = await subtle.sign('Ed25519', privateKey, message);
  return Buffer.from(signature).toString('hex');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStores() {
  return {
    rollStore: {
      start: vi.fn(),
      stop: vi.fn(),
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      claim: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(false),
      size: 0,
    },
    timerStore: {
      maxDurationMs: 7_200_000,
      validate: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({}),
      stop: vi.fn().mockResolvedValue(null),
      stopAll: vi.fn().mockResolvedValue(undefined),
      stopAllInChannel: vi.fn().mockResolvedValue(0),
      get: vi.fn().mockResolvedValue(null),
      getByChannel: vi.fn().mockResolvedValue([]),
      channelCount: vi.fn().mockResolvedValue(0),
      size: 0,
    },
  };
}

function createMockLimiter() {
  return {
    consume: vi.fn().mockReturnValue(true),
    retryAfterSeconds: vi.fn().mockReturnValue(0),
  };
}

/** Make an HTTP request to the test server. */
async function request(
  port: number,
  method: string,
  path: string,
  body?: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method,
        path,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString();
          try {
            resolve({ status: res.statusCode!, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode!, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/** Send a signed interaction POST to /interactions. */
async function signedPost(
  port: number,
  body: Record<string, unknown>
): Promise<{ status: number; body: unknown }> {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await signBody(rawBody, timestamp);

  return request(port, 'POST', '/interactions', rawBody, {
    'x-signature-ed25519': signature,
    'x-signature-timestamp': timestamp,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HTTP server', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    await generateTestKeyPair();

    // Set env vars before importing server module
    process.env.DISCORD_PUBLIC_KEY = publicKeyHex;
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.DISCORD_CLIENT_ID = 'test-app-id';
    process.env.PORT = '0'; // random port

    const { startHttpServer } = await import('../src/http/server.js');
    const stores = createMockStores();
    const limiter = createMockLimiter();

    server = startHttpServer(
      stores.rollStore as never,
      stores.timerStore as never,
      limiter as never
    );

    // Wait for server to be listening and get assigned port
    await new Promise<void>((resolve) => {
      server.on('listening', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
      // If already listening
      const addr = server.address();
      if (addr) {
        port = typeof addr === 'object' ? addr.port : 0;
        resolve();
      }
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) =>
      server.close(() => {
        resolve();
      })
    );
  });

  // Health check
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(port, 'GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', mode: 'http' });
  });

  // 404
  it('unknown path returns 404', async () => {
    const res = await request(port, 'GET', '/unknown');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  // Method not allowed
  it('GET /interactions returns 405', async () => {
    const res = await request(port, 'GET', '/interactions');
    expect(res.status).toBe(405);
  });

  // Missing signature headers
  it('POST /interactions without signature returns 401', async () => {
    const res = await request(port, 'POST', '/interactions', '{"type":1}');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Missing signature headers' });
  });

  // Invalid signature
  it('POST /interactions with invalid signature returns 401', async () => {
    const res = await request(port, 'POST', '/interactions', '{"type":1}', {
      'x-signature-ed25519': '0'.repeat(128),
      'x-signature-timestamp': '1234567890',
    });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid signature' });
  });

  // PING → PONG
  it('PING interaction returns PONG', async () => {
    const res = await signedPost(port, { type: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 1 });
  });

  // APPLICATION_COMMAND — /roll (public)
  it('public /roll returns deferred type 5 without flags', async () => {
    const res = await signedPost(port, {
      type: 2,
      data: {
        name: 'roll',
        options: [{ name: 'dice', type: 3, value: '2d6' }],
      },
      member: { user: { id: 'u1', username: 'Test' } },
      channel_id: 'ch-1',
      guild_id: 'g-1',
      token: 'tok-1',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: 5,
    });
  });

  // APPLICATION_COMMAND — /secret (secret by default)
  it('/secret returns deferred type 5 with ephemeral flag', async () => {
    const res = await signedPost(port, {
      type: 2,
      data: {
        name: 'secret',
        options: [{ name: 'dice', type: 3, value: 'd20' }],
      },
      member: { user: { id: 'u1', username: 'Test' } },
      channel_id: 'ch-1',
      guild_id: 'g-1',
      token: 'tok-2',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: 5,
      data: { flags: 64 },
    });
  });

  // APPLICATION_COMMAND — /roll secret:true
  it('/roll with secret:true returns ephemeral defer', async () => {
    const res = await signedPost(port, {
      type: 2,
      data: {
        name: 'roll',
        options: [
          { name: 'dice', type: 3, value: 'd20' },
          { name: 'secret', type: 5, value: true },
        ],
      },
      member: { user: { id: 'u1', username: 'Test' } },
      channel_id: 'ch-1',
      guild_id: 'g-1',
      token: 'tok-3',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: 5,
      data: { flags: 64 },
    });
  });

  // APPLICATION_COMMAND — /timer
  it('/timer returns deferred type 5 with ephemeral flag', async () => {
    const res = await signedPost(port, {
      type: 2,
      data: {
        name: 'timer',
        options: [
          {
            name: 'start',
            type: 1,
            options: [
              { name: 'interval', type: 4, value: 5 },
              { name: 'name', type: 3, value: 'Combat' },
            ],
          },
        ],
      },
      member: { user: { id: 'u1', username: 'Test' } },
      channel_id: 'ch-1',
      guild_id: 'g-1',
      token: 'tok-4',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: 5,
      data: { flags: 64 },
    });
  });

  // APPLICATION_COMMAND — /help
  it('/help returns deferred type 5 without ephemeral', async () => {
    const res = await signedPost(port, {
      type: 2,
      data: { name: 'help' },
      member: { user: { id: 'u1', username: 'Test' } },
      channel_id: 'ch-1',
      guild_id: 'g-1',
      token: 'tok-5',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: 5,
    });
  });

  // MESSAGE_COMPONENT — reveal button
  it('reveal button returns deferred update (type 6)', async () => {
    const res = await signedPost(port, {
      type: 3,
      data: { custom_id: 'reveal:abc-123', component_type: 2 },
      member: { user: { id: 'u1', username: 'Test' } },
      channel_id: 'ch-1',
      guild_id: 'g-1',
      token: 'tok-6',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: 6,
    });
  });

  // MESSAGE_COMPONENT — timer stop button
  it('tstop button returns deferred type 5 with ephemeral', async () => {
    const res = await signedPost(port, {
      type: 3,
      data: { custom_id: 'tstop:42', component_type: 2 },
      member: { user: { id: 'u1', username: 'Test' } },
      channel_id: 'ch-1',
      guild_id: 'g-1',
      token: 'tok-7',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: 5,
      data: { flags: 64 },
    });
  });

  // MESSAGE_COMPONENT — timer restart button
  it('trestart button returns deferred type 5 with ephemeral', async () => {
    const res = await signedPost(port, {
      type: 3,
      data: { custom_id: 'trestart:1:5:0:Combat', component_type: 2 },
      member: { user: { id: 'u1', username: 'Test' } },
      channel_id: 'ch-1',
      guild_id: 'g-1',
      token: 'tok-8',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      type: 5,
      data: { flags: 64 },
    });
  });
});
