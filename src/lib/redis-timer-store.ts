import { Redis } from "@upstash/redis";
import {
  ITimerStore,
  TimerInstance,
  TimerConfig,
  TimerCompleteReason,
} from "./store-interface.js";
import { TimerParseError } from "./timer-store.js";

/** Maximum number of concurrent timers per channel. */
const MAX_TIMERS_PER_CHANNEL = 5;

/** Interval bounds (minutes). */
const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 480;

/** Repeat bounds. */
const MAX_REPEAT = 100;

/** Timer name constraints. */
const MAX_NAME_LENGTH = 50;
const NAME_PATTERN = /^[\w\s\-]+$/;

/** Default maximum duration: 2 hours. */
const DEFAULT_MAX_TIMER_HOURS = 2;

/** Redis key prefixes. */
const TIMER_KEY = "timer:";
const CHANNEL_KEY = "timer:channel:";
const NEXT_ID_KEY = "timer:nextid";
const STOP_FLAG_KEY = "timer:stop:";

/** TTL for stop flags (60 seconds). */
const STOP_FLAG_TTL_MS = 60_000;

/** Timer metadata stored in Redis (no intervalHandle — that's local only). */
interface TimerMetadata {
  id: number;
  guildId: string;
  channelId: string;
  name: string;
  intervalMinutes: number;
  maxRepeat: number | null;
  triggerCount: number;
  startedAt: number;
  maxDurationMs: number;
  startedBy: string;
}

/**
 * Redis-backed timer store with hybrid local+remote design.
 *
 * Local setInterval handles drive the trigger callbacks.
 * Redis stores metadata for validation, listing, and cross-instance visibility.
 * Stop flags prevent double-triggering across instances.
 *
 * On restart, timers are NOT auto-resumed (they require Discord channel references).
 */
export class RedisTimerStore implements ITimerStore {
  private readonly redis: Redis;
  private readonly localTimers = new Map<number, TimerInstance>();
  readonly maxDurationMs: number;

  constructor(redis: Redis, maxDurationMs?: number) {
    this.redis = redis;
    if (maxDurationMs !== undefined) {
      this.maxDurationMs = maxDurationMs;
    } else {
      const envHours = parseInt(process.env.MAX_TIMER_HOURS ?? "", 10);
      const hours =
        Number.isFinite(envHours) && envHours >= 1 && envHours <= 24
          ? envHours
          : DEFAULT_MAX_TIMER_HOURS;
      this.maxDurationMs = hours * 60 * 60 * 1000;
    }
  }

  /** Validate timer creation parameters. */
  async validate(config: TimerConfig): Promise<void> {
    if (!config.name || config.name.trim().length === 0) {
      throw new TimerParseError("Timer name cannot be empty.");
    }
    if (config.name.length > MAX_NAME_LENGTH) {
      throw new TimerParseError(
        `Timer name is too long (max ${MAX_NAME_LENGTH} characters). You used ${config.name.length}.`
      );
    }
    if (!NAME_PATTERN.test(config.name)) {
      throw new TimerParseError(
        "Timer name contains invalid characters. Use letters, numbers, spaces, underscores, or hyphens."
      );
    }
    if (config.intervalMinutes < MIN_INTERVAL_MINUTES || config.intervalMinutes > MAX_INTERVAL_MINUTES) {
      throw new TimerParseError(
        `Interval must be between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES} minutes.`
      );
    }
    if (config.maxRepeat !== null) {
      if (config.maxRepeat < 1 || config.maxRepeat > MAX_REPEAT) {
        throw new TimerParseError(
          `Repeat count must be between 1 and ${MAX_REPEAT}.`
        );
      }
    }

    const count = await this.channelCount(config.channelId);
    if (count >= MAX_TIMERS_PER_CHANNEL) {
      throw new TimerParseError(
        `This channel already has ${MAX_TIMERS_PER_CHANNEL} active timers. Stop one first with \`/timer stop\`.`
      );
    }
  }

  /** Create and start a timer. */
  async create(
    config: TimerConfig,
    onTrigger: (timer: TimerInstance) => void | Promise<void>,
    onComplete: (timer: TimerInstance, reason: TimerCompleteReason) => void | Promise<void>,
  ): Promise<TimerInstance> {
    await this.validate(config);

    // Get next ID atomically from Redis
    const id = await this.redis.incr(NEXT_ID_KEY);
    const intervalMs = config.intervalMinutes * 60 * 1000;
    const maxDurationMs = this.maxDurationMs;
    const startedAt = Date.now();

    const timer: TimerInstance = {
      id,
      guildId: config.guildId,
      channelId: config.channelId,
      name: config.name,
      intervalMinutes: config.intervalMinutes,
      maxRepeat: config.maxRepeat,
      triggerCount: 0,
      startedAt,
      maxDurationMs,
      intervalHandle: null as unknown as ReturnType<typeof setInterval>,
      startedBy: config.startedBy,
    };

    // Store metadata in Redis
    const metadata: TimerMetadata = {
      id,
      guildId: config.guildId,
      channelId: config.channelId,
      name: config.name,
      intervalMinutes: config.intervalMinutes,
      maxRepeat: config.maxRepeat,
      triggerCount: 0,
      startedAt,
      maxDurationMs,
      startedBy: config.startedBy,
    };
    await this.redis.set(TIMER_KEY + id, JSON.stringify(metadata));
    await this.redis.sadd(CHANNEL_KEY + config.channelId, id);

    // Local setInterval for triggering
    const handle = setInterval(async () => {
      // Check stop flag
      const stopped = await this.redis.exists(STOP_FLAG_KEY + id);
      if (stopped || !this.localTimers.has(id)) {
        clearInterval(handle);
        return;
      }

      timer.triggerCount++;

      // Update trigger count in Redis
      const meta = await this.redis.get<string>(TIMER_KEY + id);
      if (meta) {
        const parsed: TimerMetadata = typeof meta === "string" ? JSON.parse(meta) : meta;
        parsed.triggerCount = timer.triggerCount;
        await this.redis.set(TIMER_KEY + id, JSON.stringify(parsed));
      }

      // Check if repeat count is exhausted
      if (timer.maxRepeat !== null && timer.triggerCount >= timer.maxRepeat) {
        clearInterval(handle);
        this.localTimers.delete(id);
        await this.cleanupRedisKeys(id, timer.channelId);
        void onTrigger(timer);
        void onComplete(timer, "repeat-exhausted");
        return;
      }

      // Check if max duration will be exceeded by the next tick
      const elapsed = Date.now() - timer.startedAt;
      if (elapsed + intervalMs > maxDurationMs) {
        clearInterval(handle);
        this.localTimers.delete(id);
        await this.cleanupRedisKeys(id, timer.channelId);
        void onTrigger(timer);
        void onComplete(timer, "max-duration");
        return;
      }

      void onTrigger(timer);
    }, intervalMs);

    timer.intervalHandle = handle;
    this.localTimers.set(id, timer);

    return timer;
  }

  /** Stop and remove a specific timer. */
  async stop(timerId: number): Promise<TimerInstance | null> {
    const timer = this.localTimers.get(timerId);
    if (!timer) {
      // May exist in Redis but not locally (different instance) — try to stop via flag
      const meta = await this.redis.get<string>(TIMER_KEY + timerId);
      if (meta) {
        const parsed: TimerMetadata = typeof meta === "string" ? JSON.parse(meta) : meta;
        await this.redis.set(STOP_FLAG_KEY + timerId, "1", { px: STOP_FLAG_TTL_MS });
        await this.cleanupRedisKeys(timerId, parsed.channelId);
        return metadataToInstance(parsed);
      }
      return null;
    }

    clearInterval(timer.intervalHandle);
    this.localTimers.delete(timerId);
    await this.redis.set(STOP_FLAG_KEY + timerId, "1", { px: STOP_FLAG_TTL_MS });
    await this.cleanupRedisKeys(timerId, timer.channelId);
    return timer;
  }

  /** Stop all timers in a channel. */
  async stopAllInChannel(channelId: string): Promise<number> {
    const members = await this.redis.smembers(CHANNEL_KEY + channelId);
    let count = 0;

    for (const memberRaw of members) {
      const id = typeof memberRaw === "number" ? memberRaw : parseInt(String(memberRaw), 10);
      if (Number.isNaN(id)) continue;

      const local = this.localTimers.get(id);
      if (local) {
        clearInterval(local.intervalHandle);
        this.localTimers.delete(id);
      }

      await this.redis.set(STOP_FLAG_KEY + id, "1", { px: STOP_FLAG_TTL_MS });
      await this.redis.del(TIMER_KEY + id);
      count++;
    }

    await this.redis.del(CHANNEL_KEY + channelId);
    return count;
  }

  /** Stop all timers (graceful shutdown). Clears local timers only. */
  async stopAll(): Promise<void> {
    for (const [id, timer] of this.localTimers) {
      clearInterval(timer.intervalHandle);
      await this.redis.set(STOP_FLAG_KEY + id, "1", { px: STOP_FLAG_TTL_MS });
      await this.cleanupRedisKeys(id, timer.channelId);
    }
    this.localTimers.clear();
  }

  /** Get a timer by ID. Checks local first, then Redis. */
  async get(timerId: number): Promise<TimerInstance | null> {
    const local = this.localTimers.get(timerId);
    if (local) return local;

    const meta = await this.redis.get<string>(TIMER_KEY + timerId);
    if (!meta) return null;
    const parsed: TimerMetadata = typeof meta === "string" ? JSON.parse(meta) : meta;
    return metadataToInstance(parsed);
  }

  /** Get all timers in a channel. */
  async getByChannel(channelId: string): Promise<TimerInstance[]> {
    const members = await this.redis.smembers(CHANNEL_KEY + channelId);
    const result: TimerInstance[] = [];

    for (const memberRaw of members) {
      const id = typeof memberRaw === "number" ? memberRaw : parseInt(String(memberRaw), 10);
      if (Number.isNaN(id)) continue;

      const local = this.localTimers.get(id);
      if (local) {
        result.push(local);
        continue;
      }

      const meta = await this.redis.get<string>(TIMER_KEY + id);
      if (meta) {
        const parsed: TimerMetadata = typeof meta === "string" ? JSON.parse(meta) : meta;
        result.push(metadataToInstance(parsed));
      }
    }

    return result;
  }

  /** Count of timers in a specific channel. */
  async channelCount(channelId: string): Promise<number> {
    return await this.redis.scard(CHANNEL_KEY + channelId);
  }

  /** Total active timer count (local only). */
  get size(): number {
    return this.localTimers.size;
  }

  /** Remove timer metadata and channel set membership from Redis. */
  private async cleanupRedisKeys(timerId: number, channelId: string): Promise<void> {
    await this.redis.del(TIMER_KEY + timerId);
    await this.redis.srem(CHANNEL_KEY + channelId, timerId);
  }
}

/** Convert Redis metadata to a TimerInstance (with a dummy intervalHandle). */
function metadataToInstance(meta: TimerMetadata): TimerInstance {
  return {
    ...meta,
    intervalHandle: null as unknown as ReturnType<typeof setInterval>,
  };
}
