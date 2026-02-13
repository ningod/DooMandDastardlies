import { RollResult } from "./dice.js";

/** Data stored for a secret roll pending reveal. */
export interface StoredRoll {
  rollId: string;
  userId: string;
  channelId: string;
  result: RollResult;
  reason: string | null;
  rolledAt: Date;
  publicMessageId: string;
  rollerTag: string;
}

/** Default TTL: 10 minutes in milliseconds. */
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** Interval between cleanup sweeps: 60 seconds. */
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * In-memory store for secret rolls with automatic TTL expiration.
 *
 * Entries are keyed by a UUID roll ID. After TTL elapses, entries are
 * removed during periodic cleanup or on access.
 */
export class RollStore {
  private readonly store = new Map<string, StoredRoll>();
  private readonly ttlMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  /** Start the periodic cleanup timer. Call once at bot startup. */
  start(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.sweep(), CLEANUP_INTERVAL_MS);
    // Allow the process to exit even if the timer is running.
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /** Stop the periodic cleanup timer. */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Store a roll and return the roll ID. */
  set(roll: StoredRoll): void {
    this.store.set(roll.rollId, roll);
  }

  /**
   * Retrieve a stored roll by ID.
   * Returns null if expired or not found.
   */
  get(rollId: string): StoredRoll | null {
    const entry = this.store.get(rollId);
    if (!entry) {
      return null;
    }

    if (this.isExpired(entry)) {
      this.store.delete(rollId);
      return null;
    }

    return entry;
  }

  /**
   * Remove a roll from the store (e.g. after reveal).
   * Returns true if the entry existed and was removed.
   */
  delete(rollId: string): boolean {
    return this.store.delete(rollId);
  }

  /** Current number of entries (including possibly-expired ones). */
  get size(): number {
    return this.store.size;
  }

  /** Remove all expired entries. */
  private sweep(): void {
    const now = Date.now();
    for (const [id, entry] of this.store) {
      if (now - entry.rolledAt.getTime() > this.ttlMs) {
        this.store.delete(id);
      }
    }
  }

  private isExpired(entry: StoredRoll): boolean {
    return Date.now() - entry.rolledAt.getTime() > this.ttlMs;
  }
}
