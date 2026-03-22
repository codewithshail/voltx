// @voltx/server — Hono-based HTTP server with file-based routing
// Built on Hono + @hono/node-server

// ─── Core ────────────────────────────────────────────────────────────────────

export { createServer } from "./server.js";

// ─── Router ──────────────────────────────────────────────────────────────────

export { scanAndRegisterRoutes, filePathToUrlPath } from "./router.js";

// ─── Static Files ────────────────────────────────────────────────────────────

export { registerStaticFiles } from "./static.js";

// ─── Middleware ──────────────────────────────────────────────────────────────

export { createCorsMiddleware } from "./middleware/cors.js";
export { createLoggerMiddleware } from "./middleware/logger.js";
export { createErrorHandler } from "./middleware/error-handler.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  ServerConfig,
  CorsConfig,
  ServerInfo,
  HttpMethod,
  RouteHandler,
  RouteModule,
  MiddlewareHandler,
  RouteEntry,
  VoltxServer,
} from "./types.js";

// ─── Re-export Hono essentials (so users don't need to install hono separately) ─

export { Hono } from "hono";
export type { Context } from "hono";

// ─── Vite Integration ────────────────────────────────────────────────────────

export { createViteDevConfig } from "./vite.js";
export type { ViteDevOptions } from "./vite.js";

// ─── SSR (Server-Side Rendering) ─────────────────────────────────────────────

export { registerSSR } from "./ssr.js";
export type { SSROptions } from "./ssr.js";

// ─── Version ─────────────────────────────────────────────────────────────────

export const VERSION = "0.4.3";
