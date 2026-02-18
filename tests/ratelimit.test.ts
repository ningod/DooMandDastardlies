import { describe, it, expect, vi } from 'vitest';
import { RateLimiter } from '../src/lib/ratelimit.js';

describe('RateLimiter', () => {
  it('allows actions under the limit', () => {
    const limiter = new RateLimiter(3, 10_000);
    expect(limiter.consume('user1')).toBe(true);
    expect(limiter.consume('user1')).toBe(true);
    expect(limiter.consume('user1')).toBe(true);
  });

  it('blocks actions over the limit', () => {
    const limiter = new RateLimiter(2, 10_000);
    expect(limiter.consume('user1')).toBe(true);
    expect(limiter.consume('user1')).toBe(true);
    expect(limiter.consume('user1')).toBe(false);
  });

  it('tracks users independently', () => {
    const limiter = new RateLimiter(1, 10_000);
    expect(limiter.consume('user1')).toBe(true);
    expect(limiter.consume('user2')).toBe(true);
    expect(limiter.consume('user1')).toBe(false);
    expect(limiter.consume('user2')).toBe(false);
  });

  it('allows actions after window expires', () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(1, 1000);

    expect(limiter.consume('user1')).toBe(true);
    expect(limiter.consume('user1')).toBe(false);

    vi.advanceTimersByTime(1001);

    expect(limiter.consume('user1')).toBe(true);

    vi.useRealTimers();
  });

  it('reports retry-after seconds', () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter(1, 5000);

    limiter.consume('user1');
    limiter.consume('user1'); // this will be rejected internally but let's check retryAfter

    const retryAfter = limiter.retryAfterSeconds('user1');
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(5);

    vi.useRealTimers();
  });

  it('returns 0 retry-after when not limited', () => {
    const limiter = new RateLimiter(5, 10_000);
    expect(limiter.retryAfterSeconds('user1')).toBe(0);
  });
});
