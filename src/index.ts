import dotenv from 'dotenv';
import { createStores } from './lib/store-factory.js';
import { RateLimiter } from './lib/ratelimit.js';
import { logger } from './lib/logger.js';

// Load environment variables from .env
dotenv.config();

// Initialize shared services
const { rollStore, timerStore } = createStores();
const limiter = new RateLimiter(5, 10_000); // 5 actions per 10 seconds

const mode = (process.env.INTERACTIONS_MODE ?? 'gateway').toLowerCase();

if (mode === 'http') {
  // Warn about memory store + multi-instance
  if ((process.env.STORAGE_BACKEND ?? 'memory').toLowerCase() === 'memory') {
    logger.warn('http-memory-store', {
      message:
        'HTTP mode with memory storage: secret rolls and timers will not persist ' +
        'across restarts or work across multiple instances. ' +
        'Consider using STORAGE_BACKEND=redis for production.',
    });
  }

  // In HTTP mode, start roll store cleanup immediately (no ClientReady event)
  rollStore.start();

  const { startHttpServer } = await import('./http/server.js');
  const server = startHttpServer(rollStore, timerStore, limiter);

  // Graceful shutdown
  async function shutdown(): Promise<void> {
    logger.info('shutdown', { mode: 'http' });
    await timerStore.stopAll();
    rollStore.stop();
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    process.exit(0);
  }

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
} else {
  if (mode !== 'gateway') {
    logger.warn('unknown-mode', {
      mode,
      message: `Unknown INTERACTIONS_MODE "${mode}", falling back to gateway.`,
    });
  }

  const { startGateway } = await import('./modes/gateway.js');
  const client = startGateway(rollStore, timerStore, limiter);

  // Graceful shutdown
  async function shutdown(): Promise<void> {
    logger.info('shutdown', { mode: 'gateway' });
    await timerStore.stopAll();
    rollStore.stop();
    await client.destroy();
    process.exit(0);
  }

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}
