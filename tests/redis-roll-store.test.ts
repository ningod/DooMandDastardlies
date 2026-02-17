import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisRollStore } from "../src/lib/redis-roll-store.js";
import { StoredRoll } from "../src/lib/store-interface.js";

// Mock @upstash/redis
const mockRedis = {
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  eval: vi.fn(),
  dbsize: vi.fn(),
};

function makeRoll(overrides?: Partial<StoredRoll>): StoredRoll {
  return {
    rollId: "test-roll-1",
    userId: "user-123",
    channelId: "channel-456",
    result: {
      expression: "2d6",
      groups: [{ group: { count: 2, sides: 6 }, rolls: [3, 5] }],
      total: 8,
    },
    comment: null,
    rolledAt: new Date("2026-01-15T12:00:00Z"),
    publicMessageId: "msg-789",
    rollerTag: "TestUser#1234",
    ...overrides,
  };
}

describe("RedisRollStore", () => {
  let store: RedisRollStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new RedisRollStore(mockRedis as never);
  });

  describe("set()", () => {
    it("calls redis.set with correct key, JSON, and TTL", async () => {
      const roll = makeRoll();
      await store.set(roll);

      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      const [key, json, opts] = mockRedis.set.mock.calls[0];
      expect(key).toBe("roll:test-roll-1");
      expect(opts).toEqual({ px: 600_000 });

      // Verify JSON contains the roll data with ISO date
      const parsed = JSON.parse(json);
      expect(parsed.rollId).toBe("test-roll-1");
      expect(parsed.userId).toBe("user-123");
      expect(parsed.rolledAt).toBe("2026-01-15T12:00:00.000Z");
    });
  });

  describe("get()", () => {
    it("returns parsed StoredRoll with Date restored", async () => {
      const roll = makeRoll();
      const json = JSON.stringify({ ...roll, rolledAt: roll.rolledAt.toISOString() });
      mockRedis.get.mockResolvedValue(json);

      const result = await store.get("test-roll-1");

      expect(mockRedis.get).toHaveBeenCalledWith("roll:test-roll-1");
      expect(result).not.toBeNull();
      expect(result!.rollId).toBe("test-roll-1");
      expect(result!.rolledAt).toBeInstanceOf(Date);
      expect(result!.rolledAt.toISOString()).toBe("2026-01-15T12:00:00.000Z");
    });

    it("returns null when key not found", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await store.get("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("claim()", () => {
    it("calls redis.eval with Lua script and returns parsed roll", async () => {
      const roll = makeRoll();
      const json = JSON.stringify({ ...roll, rolledAt: roll.rolledAt.toISOString() });
      mockRedis.eval.mockResolvedValue(json);

      const result = await store.claim("test-roll-1");

      expect(mockRedis.eval).toHaveBeenCalledTimes(1);
      const [script, keys] = mockRedis.eval.mock.calls[0];
      expect(script).toContain("redis.call('GET'");
      expect(script).toContain("redis.call('DEL'");
      expect(keys).toEqual(["roll:test-roll-1"]);

      expect(result).not.toBeNull();
      expect(result!.rollId).toBe("test-roll-1");
    });

    it("returns null when Lua script returns null", async () => {
      mockRedis.eval.mockResolvedValue(null);

      const result = await store.claim("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("delete()", () => {
    it("returns true when key existed", async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await store.delete("test-roll-1");

      expect(mockRedis.del).toHaveBeenCalledWith("roll:test-roll-1");
      expect(result).toBe(true);
    });

    it("returns false when key did not exist", async () => {
      mockRedis.del.mockResolvedValue(0);

      const result = await store.delete("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("size", () => {
    it("returns dbsize result", async () => {
      mockRedis.dbsize.mockResolvedValue(42);

      const result = await store.size;

      expect(result).toBe(42);
    });
  });

  describe("start() / stop()", () => {
    it("are no-ops that do not throw", () => {
      expect(() => store.start()).not.toThrow();
      expect(() => store.stop()).not.toThrow();
    });
  });
});
