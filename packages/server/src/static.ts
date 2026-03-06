// @voltx/server — Static file serving
// Serves static files from a directory (e.g., public/ or built frontend assets)

import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

/**
 * Register static file serving on a Hono app.
 *
 * @param app - Hono app instance
 * @param staticDir - Relative path to the static files directory (default: "public")
 */
export function registerStaticFiles(app: Hono, staticDir = "public"): void {
  // Serve files from the static directory at the root path
  // e.g., public/favicon.ico → GET /favicon.ico
  app.use("/*", serveStatic({ root: `./${staticDir}` }));
}
