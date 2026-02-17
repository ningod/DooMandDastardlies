import { RollResult } from "./dice.js";

// ---------------------------------------------------------------------------
// Shared data types (owned here, re-exported from original modules)
// ---------------------------------------------------------------------------

/** Data stored for a secret roll pending reveal. */
export interface StoredRoll {
  rollId: string;
  userId: string;
  channelId: string;
  result: RollResult;
  comment: string | null;
  rolledAt: Date;
  publicMessageId: string;
  rollerTag: string;
}

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

// ---------------------------------------------------------------------------
// Storage interfaces
// ---------------------------------------------------------------------------

/**
 * Async interface for roll storage.
 *
 * Both memory and Redis implementations satisfy this contract.
 * The `claim()` method provides atomic get+delete semantics
 * for safe concurrent reveal handling.
 */
export interface IRollStore {
  /** Start background maintenance (e.g. TTL sweep). */
  start(): void;

  /** Stop background maintenance. */
  stop(): void;

  /** Store a secret roll. */
  set(roll: StoredRoll): Promise<void>;

  /** Retrieve a stored roll by ID (non-destructive). Returns null if not found or expired. */
  get(rollId: string): Promise<StoredRoll | null>;

  /**
   * Atomically retrieve and delete a roll.
   * Returns the roll if it existed, null otherwise.
   * In Redis this uses a Lua script to guarantee only one caller succeeds.
   */
  claim(rollId: string): Promise<StoredRoll | null>;

  /** Delete a roll by ID. Returns true if it existed. */
  delete(rollId: string): Promise<boolean>;

  /** Current number of stored entries. May be approximate for Redis. */
  readonly size: number | Promise<number>;
}

/**
 * Async interface for timer storage.
 *
 * Both memory and Redis implementations satisfy this contract.
 * Timer scheduling (setInterval) is always local; Redis stores metadata
 * for validation and cross-instance visibility.
 */
export interface ITimerStore {
  /** Maximum timer duration in milliseconds. */
  readonly maxDurationMs: number;

  /** Validate timer creation parameters. Throws TimerParseError on failure. */
  validate(config: TimerConfig): Promise<void>;

  /** Create and start a timer. */
  create(
    config: TimerConfig,
    onTrigger: (timer: TimerInstance) => void | Promise<void>,
    onComplete: (timer: TimerInstance, reason: TimerCompleteReason) => void | Promise<void>,
  ): Promise<TimerInstance>;

  /** Stop and remove a specific timer. Returns the stopped timer or null. */
  stop(timerId: number): Promise<TimerInstance | null>;

  /** Stop all timers in a channel. Returns count of stopped timers. */
  stopAllInChannel(channelId: string): Promise<number>;

  /** Stop all timers (graceful shutdown). */
  stopAll(): Promise<void>;

  /** Get a timer by ID. */
  get(timerId: number): Promise<TimerInstance | null>;

  /** Get all timers in a channel. */
  getByChannel(channelId: string): Promise<TimerInstance[]>;

  /** Count of timers in a specific channel. */
  channelCount(channelId: string): Promise<number>;

  /** Total active timer count. May be approximate for Redis. */
  readonly size: number | Promise<number>;
}
