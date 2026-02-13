/**
 * Minimal structured logger.
 *
 * Logs JSON lines to stdout/stderr. Intentionally avoids logging
 * roll results (secret data) — only metadata is emitted.
 */
export const logger = {
  info(event: string, meta?: Record<string, unknown>): void {
    const entry = {
      level: "info",
      event,
      ts: new Date().toISOString(),
      ...meta,
    };
    process.stdout.write(JSON.stringify(entry) + "\n");
  },

  warn(event: string, meta?: Record<string, unknown>): void {
    const entry = {
      level: "warn",
      event,
      ts: new Date().toISOString(),
      ...meta,
    };
    process.stderr.write(JSON.stringify(entry) + "\n");
  },

  error(event: string, meta?: Record<string, unknown>): void {
    const entry = {
      level: "error",
      event,
      ts: new Date().toISOString(),
      ...meta,
    };
    process.stderr.write(JSON.stringify(entry) + "\n");
  },
};
