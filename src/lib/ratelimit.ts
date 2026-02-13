/**
 * Simple sliding-window rate limiter per user.
 *
 * Tracks timestamps of recent actions per user ID and rejects
 * actions that exceed the configured limit within the window.
 */
export class RateLimiter {
  /** Map of user ID → array of action timestamps (ms). */
  private readonly hits = new Map<string, number[]>();

  /** Maximum allowed actions within the window. */
  private readonly maxActions: number;

  /** Time window in milliseconds. */
  private readonly windowMs: number;

  /**
   * @param maxActions - Max actions allowed per window (default 5).
   * @param windowMs  - Window duration in ms (default 10_000 = 10s).
   */
  constructor(maxActions = 5, windowMs = 10_000) {
    this.maxActions = maxActions;
    this.windowMs = windowMs;
  }

  /**
   * Check if the user is allowed to perform an action.
   * If allowed, records the action and returns true.
   * If rate-limited, returns false.
   */
  consume(userId: string): boolean {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let timestamps = this.hits.get(userId);
    if (!timestamps) {
      timestamps = [];
      this.hits.set(userId, timestamps);
    }

    // Remove expired timestamps
    const filtered = timestamps.filter((t) => t > cutoff);

    if (filtered.length >= this.maxActions) {
      // Still over limit after pruning — reject
      this.hits.set(userId, filtered);
      return false;
    }

    // Allow and record
    filtered.push(now);
    this.hits.set(userId, filtered);
    return true;
  }

  /**
   * Get remaining seconds until the user can act again.
   * Returns 0 if not rate-limited.
   */
  retryAfterSeconds(userId: string): number {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const timestamps = this.hits.get(userId);
    if (!timestamps) return 0;

    const filtered = timestamps.filter((t) => t > cutoff);
    if (filtered.length < this.maxActions) return 0;

    // Oldest relevant timestamp determines when a slot frees up
    const oldest = filtered[0];
    const retryAt = oldest + this.windowMs;
    return Math.ceil((retryAt - now) / 1000);
  }
}
