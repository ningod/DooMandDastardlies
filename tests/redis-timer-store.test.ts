import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisTimerStore } from '../src/lib/redis-timer-store.js';
import { TimerParseError } from '../src/lib/timer-store.js';
import type { TimerConfig } from '../src/lib/store-interface.js';

// Mock @upstash/redis
const mockRedis = {
  incr: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  sadd: vi.fn(),
  srem: vi.fn(),
  scard: vi.fn(),
  smembers: vi.fn(),
  exists: vi.fn(),
};

function makeConfig(overrides?: Partial<TimerConfig>): TimerConfig {
  return {
    guildId: 'guild-1',
    channelId: 'channel-1',
    name: 'Test Timer',
    intervalMinutes: 5,
    maxRepeat: null,
    startedBy: 'user-1',
    ...overrides,
  };
}

describe('RedisTimerStore', () => {
  let store: RedisTimerStore;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRedis.scard.mockResolvedValue(0);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.sadd.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(0);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.del.mockResolvedValue(1);
    mockRedis.srem.mockResolvedValue(1);
    mockRedis.smembers.mockResolvedValue([]);
    // Use an explicit test prefix so key assertions are stable
    store = new RedisTimerStore(mockRedis as never, 2 * 60 * 60 * 1000, 'test');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('validate()', () => {
    it('accepts valid config', async () => {
      await expect(store.validate(makeConfig())).resolves.toBeUndefined();
    });

    it('rejects empty name', async () => {
      await expect(store.validate(makeConfig({ name: '' }))).rejects.toThrow(TimerParseError);
    });

    it('rejects name longer than 50 characters', async () => {
      await expect(store.validate(makeConfig({ name: 'A'.repeat(51) }))).rejects.toThrow(
        /too long/
      );
    });

    it('rejects when channel at capacity', async () => {
      mockRedis.scard.mockResolvedValue(5);
      await expect(store.validate(makeConfig())).rejects.toThrow(/already has 5/);
    });

    it('uses SCARD with namespaced channel key for capacity check', async () => {
      await store.validate(makeConfig());
      expect(mockRedis.scard).toHaveBeenCalledWith('test:timer:channel:channel-1');
    });
  });

  describe('create()', () => {
    it('calls INCR for namespaced ID key, SET for metadata, SADD for channel set', async () => {
      mockRedis.incr.mockResolvedValue(7);
      const noop = vi.fn();

      const timer = await store.create(makeConfig(), noop, noop);

      expect(timer.id).toBe(7);
      expect(mockRedis.incr).toHaveBeenCalledWith('test:timer:nextid');
      expect(mockRedis.set).toHaveBeenCalledWith('test:timer:7', expect.any(String));
      expect(mockRedis.sadd).toHaveBeenCalledWith('test:timer:channel:channel-1', 7);

      await store.stopAll();
    });

    it('returns a TimerInstance with correct fields', async () => {
      mockRedis.incr.mockResolvedValue(3);
      const noop = vi.fn();

      const timer = await store.create(makeConfig({ name: 'Combat' }), noop, noop);

      expect(timer.name).toBe('Combat');
      expect(timer.intervalMinutes).toBe(5);
      expect(timer.triggerCount).toBe(0);

      await store.stopAll();
    });
  });

  describe('stop()', () => {
    it('clears local interval and sets namespaced stop flag in Redis', async () => {
      mockRedis.incr.mockResolvedValue(1);
      const noop = vi.fn();

      const timer = await store.create(makeConfig(), noop, noop);
      const stopped = await store.stop(timer.id);

      expect(stopped).not.toBeNull();
      expect(stopped!.id).toBe(timer.id);
      // Should set namespaced stop flag
      expect(mockRedis.set).toHaveBeenCalledWith('test:timer:stop:1', '1', { px: 60_000 });
      // Should cleanup namespaced keys
      expect(mockRedis.del).toHaveBeenCalledWith('test:timer:1');
      expect(mockRedis.srem).toHaveBeenCalledWith('test:timer:channel:channel-1', 1);
    });

    it('stops remote-only timer via stop flag when not local', async () => {
      const metadata = JSON.stringify({
        id: 99,
        guildId: 'guild-1',
        channelId: 'channel-1',
        name: 'Remote Timer',
        intervalMinutes: 5,
        maxRepeat: null,
        triggerCount: 2,
        startedAt: Date.now(),
        maxDurationMs: 7200000,
        startedBy: 'user-1',
      });
      mockRedis.get.mockResolvedValue(metadata);

      const stopped = await store.stop(99);

      expect(stopped).not.toBeNull();
      expect(stopped!.id).toBe(99);
      expect(mockRedis.set).toHaveBeenCalledWith('test:timer:stop:99', '1', { px: 60_000 });
    });

    it('returns null for non-existent timer', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await store.stop(999);
      expect(result).toBeNull();
    });
  });

  describe('stopAllInChannel()', () => {
    it('uses namespaced SMEMBERS key and stops each timer', async () => {
      mockRedis.smembers.mockResolvedValue([1, 2]);

      const count = await store.stopAllInChannel('channel-1');

      expect(count).toBe(2);
      expect(mockRedis.smembers).toHaveBeenCalledWith('test:timer:channel:channel-1');
      expect(mockRedis.del).toHaveBeenCalledWith('test:timer:channel:channel-1');
    });
  });

  describe('get()', () => {
    it('returns local timer if available', async () => {
      mockRedis.incr.mockResolvedValue(1);
      const noop = vi.fn();
      const timer = await store.create(makeConfig(), noop, noop);

      const result = await store.get(timer.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(timer.id);

      await store.stopAll();
    });

    it('falls back to Redis metadata when not local', async () => {
      const metadata = JSON.stringify({
        id: 42,
        guildId: 'guild-1',
        channelId: 'channel-1',
        name: 'Remote',
        intervalMinutes: 10,
        maxRepeat: null,
        triggerCount: 1,
        startedAt: Date.now(),
        maxDurationMs: 7200000,
        startedBy: 'user-1',
      });
      mockRedis.get.mockResolvedValue(metadata);

      const result = await store.get(42);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('Remote');
    });

    it('returns null when not found anywhere', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await store.get(999);
      expect(result).toBeNull();
    });
  });

  describe('getByChannel()', () => {
    it('uses namespaced SMEMBERS + individual GET for each timer', async () => {
      mockRedis.smembers.mockResolvedValue([1, 2]);
      mockRedis.get
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 1,
            guildId: 'g',
            channelId: 'ch',
            name: 'T1',
            intervalMinutes: 5,
            maxRepeat: null,
            triggerCount: 0,
            startedAt: Date.now(),
            maxDurationMs: 7200000,
            startedBy: 'u',
          })
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            id: 2,
            guildId: 'g',
            channelId: 'ch',
            name: 'T2',
            intervalMinutes: 10,
            maxRepeat: 3,
            triggerCount: 1,
            startedAt: Date.now(),
            maxDurationMs: 7200000,
            startedBy: 'u',
          })
        );

      const result = await store.getByChannel('ch');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('T1');
      expect(result[1].name).toBe('T2');
    });
  });

  describe('channelCount()', () => {
    it('uses namespaced SCARD key', async () => {
      mockRedis.scard.mockResolvedValue(3);
      const count = await store.channelCount('channel-1');
      expect(count).toBe(3);
      expect(mockRedis.scard).toHaveBeenCalledWith('test:timer:channel:channel-1');
    });
  });

  describe('key prefix isolation', () => {
    it('uses the default prefix "doomanddastardlies" when none is specified', async () => {
      const defaultStore = new RedisTimerStore(mockRedis as never, 2 * 60 * 60 * 1000);
      await defaultStore.validate(makeConfig());
      expect(mockRedis.scard).toHaveBeenCalledWith('doomanddastardlies:timer:channel:channel-1');
    });

    it('uses a custom prefix to isolate keys from other applications', async () => {
      const storeA = new RedisTimerStore(mockRedis as never, 2 * 60 * 60 * 1000, 'app-a');
      const storeB = new RedisTimerStore(mockRedis as never, 2 * 60 * 60 * 1000, 'app-b');

      await storeA.channelCount('channel-1');
      await storeB.channelCount('channel-1');

      expect(mockRedis.scard).toHaveBeenNthCalledWith(1, 'app-a:timer:channel:channel-1');
      expect(mockRedis.scard).toHaveBeenNthCalledWith(2, 'app-b:timer:channel:channel-1');
    });
  });
});
