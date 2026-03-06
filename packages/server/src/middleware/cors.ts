// @voltx/server — CORS middleware

import { cors as honoCors } from "hono/cors";
import type { CorsConfig } from "../types.js";

/**
 * Create CORS middleware from VoltX config.
 * Wraps Hono's built-in CORS middleware with sensible defaults.
 */
export function createCorsMiddleware(config?: boolean | CorsConfig) {
  if (config === false) return null;

  const opts: CorsConfig = typeof config === "object" ? config : {};

  return honoCors({
    origin: opts.origin ?? "*",
    allowMethods: opts.allowMethods ?? ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: opts.allowHeaders ?? ["Content-Type", "Authorization"],
    exposeHeaders: opts.exposeHeaders ?? [],
    maxAge: opts.maxAge ?? 600,
    credentials: opts.credentials ?? false,
  });
}
