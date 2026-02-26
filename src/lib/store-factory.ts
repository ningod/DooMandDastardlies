import { Redis } from '@upstash/redis';
import type { IRollStore, ITimerStore } from './store-interface.js';
import { MemoryRollStore } from './store.js';
import { MemoryTimerStore } from './timer-store.js';
import { RedisRollStore } from './redis-roll-store.js';
import { RedisTimerStore } from './redis-timer-store.js';
import { logger } from './logger.js';

/**
 * Create roll and timer stores based on the STORAGE_BACKEND env variable.
 *
 * - `"memory"` (default): In-memory stores, no external dependencies.
 * - `"redis"`: Upstash Redis stores, requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.
 *
 * When using Redis, all keys are namespaced under UPSTASH_REDIS_KEY_PREFIX
 * (default: "doomanddastardlies") so multiple applications can safely share
 * the same Redis instance without key collisions.
 */
export function createStores(): { rollStore: IRollStore; timerStore: ITimerStore } {
  const backend = (process.env.STORAGE_BACKEND ?? 'memory').toLowerCase();

  if (backend === 'redis') {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        'STORAGE_BACKEND=redis requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
      );
    }

    const redis = new Redis({ url, token });
    const keyPrefix = process.env.UPSTASH_REDIS_KEY_PREFIX ?? 'doomanddastardlies';

    logger.info('storage-backend', { backend: 'redis', keyPrefix });

    return {
      rollStore: new RedisRollStore(redis, 10 * 60 * 1000, keyPrefix),
      timerStore: new RedisTimerStore(redis, undefined, keyPrefix),
    };
  }

  if (backend !== 'memory') {
    logger.warn('storage-backend-unknown', {
      backend,
      message: `Unknown STORAGE_BACKEND "${backend}", falling back to memory.`,
    });
  }

  logger.info('storage-backend', { backend: 'memory' });

  return {
    rollStore: new MemoryRollStore(),
    timerStore: new MemoryTimerStore(),
  };
}
