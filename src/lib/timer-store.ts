/**
 * In-memory store for active event timers with automatic lifecycle management.
 *
 * Each timer gets its own setInterval handle. Timers are scoped to guild+channel,
 * capped by MAX_TIMER_HOURS, and support optional repeat limits.
 */

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

/** Completion reason for the onComplete callback. */
export type TimerCompleteReason = "repeat-exhausted" | "max-duration";

/** A running timer instance. */
export interface TimerInstance {
  id: number;
  guildId: string;
  channelId: string;
  name: string;
  intervalMinutes: number;
  maxRepeat: number | null;
  triggerCount: number;
  startedAt: number;
  maxDurationMs: number;
  intervalHandle: ReturnType<typeof setInterval>;
  startedBy: string;
}

/** Parameters for creating a timer (before interval handle exists). */
export interface TimerConfig {
  guildId: string;
  channelId: string;
  name: string;
  intervalMinutes: number;
  maxRepeat: number | null;
  startedBy: string;
}

/** Custom error for timer validation failures. */
export class TimerParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimerParseError";
  }
}

export class TimerStore {
  private readonly timers = new Map<number, TimerInstance>();
  private nextId = 1;
  readonly maxDurationMs: number;

  constructor(maxDurationMs?: number) {
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

  /**
   * Validate timer creation parameters.
   * Throws TimerParseError with a user-friendly message on failure.
   */
  validate(config: TimerConfig): void {
    // Name checks
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

    // Interval checks
    if (config.intervalMinutes < MIN_INTERVAL_MINUTES || config.intervalMinutes > MAX_INTERVAL_MINUTES) {
      throw new TimerParseError(
        `Interval must be between ${MIN_INTERVAL_MINUTES} and ${MAX_INTERVAL_MINUTES} minutes.`
      );
    }

    // Repeat checks
    if (config.maxRepeat !== null) {
      if (config.maxRepeat < 1 || config.maxRepeat > MAX_REPEAT) {
        throw new TimerParseError(
          `Repeat count must be between 1 and ${MAX_REPEAT}.`
        );
      }
    }

    // Channel capacity
    if (this.channelCount(config.channelId) >= MAX_TIMERS_PER_CHANNEL) {
      throw new TimerParseError(
        `This channel already has ${MAX_TIMERS_PER_CHANNEL} active timers. Stop one first with \`/timer stop\`.`
      );
    }
  }

  /**
   * Create and start a timer.
   *
   * @param config - Timer configuration
   * @param onTrigger - Called on each interval tick
   * @param onComplete - Called when the timer ends naturally
   * @returns The created TimerInstance
   */
  create(
    config: TimerConfig,
    onTrigger: (timer: TimerInstance) => void | Promise<void>,
    onComplete: (timer: TimerInstance, reason: TimerCompleteReason) => void | Promise<void>,
  ): TimerInstance {
    this.validate(config);

    const id = this.nextId++;
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

    const handle = setInterval(() => {
      // Timer may have been removed by stop() between ticks
      if (!this.timers.has(id)) {
        clearInterval(handle);
        return;
      }

      timer.triggerCount++;

      // Check if repeat count is exhausted
      if (timer.maxRepeat !== null && timer.triggerCount >= timer.maxRepeat) {
        clearInterval(handle);
        this.timers.delete(id);
        void onTrigger(timer);
        void onComplete(timer, "repeat-exhausted");
        return;
      }

      // Check if max duration will be exceeded by the next tick
      const elapsed = Date.now() - timer.startedAt;
      if (elapsed + intervalMs > maxDurationMs) {
        clearInterval(handle);
        this.timers.delete(id);
        void onTrigger(timer);
        void onComplete(timer, "max-duration");
        return;
      }

      void onTrigger(timer);
    }, intervalMs);

    timer.intervalHandle = handle;
    this.timers.set(id, timer);

    return timer;
  }

  /** Stop and remove a specific timer. Returns the stopped timer or null. */
  stop(timerId: number): TimerInstance | null {
    const timer = this.timers.get(timerId);
    if (!timer) return null;

    clearInterval(timer.intervalHandle);
    this.timers.delete(timerId);
    return timer;
  }

  /** Stop all timers in a channel. Returns the count of stopped timers. */
  stopAllInChannel(channelId: string): number {
    let count = 0;
    for (const [id, timer] of this.timers) {
      if (timer.channelId === channelId) {
        clearInterval(timer.intervalHandle);
        this.timers.delete(id);
        count++;
      }
    }
    return count;
  }

  /** Stop ALL timers (graceful shutdown). */
  stopAll(): void {
    for (const [, timer] of this.timers) {
      clearInterval(timer.intervalHandle);
    }
    this.timers.clear();
  }

  /** Get a timer by ID. */
  get(timerId: number): TimerInstance | null {
    return this.timers.get(timerId) ?? null;
  }

  /** Get all timers in a channel. */
  getByChannel(channelId: string): TimerInstance[] {
    const result: TimerInstance[] = [];
    for (const timer of this.timers.values()) {
      if (timer.channelId === channelId) {
        result.push(timer);
      }
    }
    return result;
  }

  /** Total active timer count. */
  get size(): number {
    return this.timers.size;
  }

  /** Count of timers in a specific channel. */
  channelCount(channelId: string): number {
    let count = 0;
    for (const timer of this.timers.values()) {
      if (timer.channelId === channelId) {
        count++;
      }
    }
    return count;
  }
}
