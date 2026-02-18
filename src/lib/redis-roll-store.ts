import type { Redis } from '@upstash/redis';
import type { IRollStore, StoredRoll } from './store-interface.js';

/** Default TTL: 10 minutes in milliseconds. */
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** Redis key prefix for rolls. */
const KEY_PREFIX = 'roll:';

/**
 * Lua script for atomic get+delete (claim).
 * Returns the value if found, nil otherwise.
 */
const CLAIM_SCRIPT = `
local val = redis.call('GET', KEYS[1])
if val then
  redis.call('DEL', KEYS[1])
end
return val
`;

/**
 * Redis-backed store for secret rolls.
 *
 * Uses native Redis TTL for automatic expiration (no sweep needed).
 * Serializes StoredRoll as JSON, with Date fields converted to ISO strings.
 */
export class RedisRollStore implements IRollStore {
  private readonly redis: Redis;
  private readonly ttlMs: number;

  constructor(redis: Redis, ttlMs: number = DEFAULT_TTL_MS) {
    this.redis = redis;
    this.ttlMs = ttlMs;
  }

  /** No-op — Redis handles TTL natively. */
  start(): void {}

  /** No-op — no background timers to clean up. */
  stop(): void {}

  /** Store a roll with TTL. */
  async set(roll: StoredRoll): Promise<void> {
    const key = KEY_PREFIX + roll.rollId;
    const json = JSON.stringify(roll, dateReplacer);
    await this.redis.set(key, json, { px: this.ttlMs });
  }

  /** Retrieve a stored roll by ID. Returns null if not found or expired. */
  async get(rollId: string): Promise<StoredRoll | null> {
    const key = KEY_PREFIX + rollId;
    const raw = await this.redis.get<string>(key);
    if (!raw) return null;
    return parseStoredRoll(raw);
  }

  /**
   * Atomically retrieve and delete a roll via Lua script.
   * Guarantees only one concurrent caller succeeds.
   */
  async claim(rollId: string): Promise<StoredRoll | null> {
    const key = KEY_PREFIX + rollId;
    const raw = await this.redis.eval(CLAIM_SCRIPT, [key], []);
    if (!raw) return null;
    return parseStoredRoll(raw as string);
  }

  /** Delete a roll by ID. Returns true if it existed. */
  async delete(rollId: string): Promise<boolean> {
    const key = KEY_PREFIX + rollId;
    const count = await this.redis.del(key);
    return count > 0;
  }

  /** Approximate count of entries in the database. */
  get size(): Promise<number> {
    return this.redis.dbsize();
  }
}

/** JSON replacer that converts Date to ISO string. */
function dateReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

/** Parse a JSON string back into a StoredRoll, restoring Date fields. */
function parseStoredRoll(raw: string): StoredRoll {
  const data = JSON.parse(raw) as StoredRoll;
  return {
    ...data,
    rolledAt: new Date(data.rolledAt),
  };
}
