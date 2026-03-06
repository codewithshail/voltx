// @voltx/server — Logger middleware

import { logger as honoLogger } from "hono/logger";

/**
 * Create request logger middleware.
 * Wraps Hono's built-in logger with VoltX prefix.
 */
export function createLoggerMiddleware() {
  return honoLogger((message: string, ...rest: string[]) => {
    console.log(`[voltx] ${message}`, ...rest);
  });
}
