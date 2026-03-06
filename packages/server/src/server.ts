// @voltx/server — Server creation and lifecycle

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { resolve } from "node:path";
import type { ServerConfig, ServerInfo, VoltxServer, RouteEntry } from "./types.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { createLoggerMiddleware } from "./middleware/logger.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { scanAndRegisterRoutes } from "./router.js";
import { registerStaticFiles } from "./static.js";

/**
 * Create a VoltX server instance.
 *
 * @example
 * ```ts
 * import { createServer } from "@voltx/server";
 *
 * const server = createServer({
 *   port: 3000,
 *   routesDir: "src/routes",
 *   cors: true,
 *   logger: true,
 * });
 *
 * await server.start();
 * ```
 */
export function createServer(config: ServerConfig = {}): VoltxServer {
  const {
    port = Number(process.env.PORT) || 3000,
    hostname = "0.0.0.0",
    routesDir = "src/routes",
    staticDir = "public",
    cors = true,
    logger: enableLogger = process.env.NODE_ENV !== "production",
    onError,
    onStart,
  } = config;

  const app = new Hono();
  const registeredRoutes: RouteEntry[] = [];
  let httpServer: ReturnType<typeof serve> | null = null;

  // ─── Middleware ───────────────────────────────────────────────────────

  // Logger (before everything)
  if (enableLogger) {
    app.use("*", createLoggerMiddleware());
  }

  // CORS (before routes)
  const corsMiddleware = createCorsMiddleware(cors);
  if (corsMiddleware) {
    app.use("*", corsMiddleware);
  }

  // Error handler
  app.onError(createErrorHandler(onError));

  // 404 handler — returns JSON instead of Hono's default plain text
  app.notFound((c) => {
    return c.json(
      { error: { message: "Not Found", status: 404 } },
      404,
    );
  });

  // ─── Server Instance ─────────────────────────────────────────────────

  const server: VoltxServer = {
    app,

    async start(): Promise<ServerInfo> {
      // Register file-based routes
      const absRoutesDir = resolve(process.cwd(), routesDir);
      const routes = await scanAndRegisterRoutes(app, absRoutesDir);
      registeredRoutes.push(...routes);

      // Static files (registered last — fallback for unmatched routes)
      registerStaticFiles(app, staticDir);

      // Start the HTTP server
      const info: ServerInfo = {
        port,
        hostname,
        url: `http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port}`,
      };

      httpServer = serve({
        fetch: app.fetch,
        port,
        hostname,
      });

      // Log startup info
      console.log(`\n  ⚡ VoltX server running at ${info.url}\n`);
      if (registeredRoutes.length > 0) {
        console.log(`  Routes (${registeredRoutes.length}):`);
        for (const route of registeredRoutes) {
          console.log(`    ${route.method.padEnd(7)} ${route.path}`);
        }
        console.log();
      }

      onStart?.(info);
      return info;
    },

    async stop(): Promise<void> {
      if (httpServer) {
        await new Promise<void>((resolve, reject) => {
          httpServer!.close((err) => {
            if (err) reject(err);
            else resolve();
          });
        });
        httpServer = null;
        console.log("\n  ⚡ VoltX server stopped.\n");
      }
    },

    async registerRoutes(dir: string): Promise<RouteEntry[]> {
      const absDir = resolve(process.cwd(), dir);
      const routes = await scanAndRegisterRoutes(app, absDir);
      registeredRoutes.push(...routes);
      return routes;
    },

    routes(): RouteEntry[] {
      return [...registeredRoutes];
    },
  };

  return server;
}
