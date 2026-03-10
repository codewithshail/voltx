// @voltx/server — File-based route scanner
// Scans a directory for route files and registers them on the Hono app.
//
// Convention (routesDir = "api"):
//   api/chat.ts              → /api/chat
//   api/users/[id].ts        → /api/users/:id
//   api/index.ts             → /api
//   api/agents/[name]/index.ts → /api/agents/:name
//
// Each file exports HTTP method handlers: GET, POST, PUT, DELETE, PATCH, etc.
// Optionally exports `middleware` for per-route middleware.

import { readdir, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { pathToFileURL } from "node:url";
import type { Hono } from "hono";
import type { RouteEntry, RouteModule, HttpMethod } from "./types.js";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
const ROUTE_EXTENSIONS = new Set([".ts", ".js", ".mjs", ".mts"]);

/**
 * Scan a directory for route files and register them on a Hono app.
 *
 * @param app - Hono app instance
 * @param routesDir - Absolute path to the routes directory
 * @returns Array of registered route entries
 */
export async function scanAndRegisterRoutes(
  app: Hono,
  routesDir: string,
): Promise<RouteEntry[]> {
  const entries: RouteEntry[] = [];

  const files = await collectRouteFiles(routesDir);

  // Sort routes: specific paths first, dynamic (:param) second, catch-all (*) last.
  // This ensures Hono registers them in the correct priority order.
  files.sort((a, b) => {
    const pathA = filePathToUrlPath(a, routesDir);
    const pathB = filePathToUrlPath(b, routesDir);
    const scoreA = pathA.includes("*") ? 2 : pathA.includes(":") ? 1 : 0;
    const scoreB = pathB.includes("*") ? 2 : pathB.includes(":") ? 1 : 0;
    if (scoreA !== scoreB) return scoreA - scoreB;
    return pathA.localeCompare(pathB);
  });

  for (const filePath of files) {
    const urlPath = filePathToUrlPath(filePath, routesDir);
    const routeModule = await importRouteModule(filePath);
    if (!routeModule) continue;

    // Register per-route middleware if exported (once per file, before handlers)
    if (routeModule.middleware) {
      const middlewares = Array.isArray(routeModule.middleware)
        ? routeModule.middleware
        : [routeModule.middleware];
      for (const mw of middlewares) {
        app.use(urlPath, mw);
      }
    }

    for (const method of HTTP_METHODS) {
      const handler = routeModule[method];
      if (typeof handler !== "function") continue;

      // Register the handler using Hono's .on() method (supports all HTTP methods)
      app.on(method, urlPath, handler);

      entries.push({ method, path: urlPath, handler, filePath });
    }
  }

  return entries;
}

/**
 * Recursively collect all route files from a directory.
 */
async function collectRouteFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  let dirEntries: string[];
  try {
    dirEntries = await readdir(dir);
  } catch {
    // Directory doesn't exist — not an error, just no routes
    return files;
  }

  for (const name of dirEntries) {
    const fullPath = join(dir, name);
    const info = await stat(fullPath);

    if (info.isDirectory()) {
      const nested = await collectRouteFiles(fullPath);
      files.push(...nested);
    } else if (info.isFile() && ROUTE_EXTENSIONS.has(extname(name))) {
      // Skip files starting with _ or . (private/hidden)
      if (name.startsWith("_") || name.startsWith(".")) continue;
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Convert a file path to a URL path.
 *
 * Examples (routesDir = "api"):
 *   api/index.ts             → /api
 *   api/chat.ts              → /api/chat
 *   api/users/[id].ts        → /api/users/:id
 *   api/[...slug].ts         → /api/*
 */
export function filePathToUrlPath(filePath: string, routesDir: string): string {
  let rel = relative(routesDir, filePath);

  // Remove extension
  const ext = extname(rel);
  rel = rel.slice(0, -ext.length);

  // Normalize separators to /
  rel = rel.replace(/\\/g, "/");

  // Remove trailing /index
  if (rel === "index") rel = "";
  else if (rel.endsWith("/index")) {
    rel = rel.slice(0, -"/index".length);
  }

  // Convert [param] → :param
  rel = rel.replace(/\[([^\]\.]+)\]/g, ":$1");

  // Convert [...slug] → * (catch-all)
  rel = rel.replace(/\[\.\.\.([^\]]+)\]/g, "*");

  // Derive prefix from the routesDir basename (e.g., "api" → "/api")
  const dirBasename = routesDir.replace(/\\/g, "/").split("/").pop() ?? "";
  const prefix = dirBasename && dirBasename !== "routes" && dirBasename !== "src" ? `/${dirBasename}` : "";

  if (!rel) return prefix || "/";
  return `${prefix}/${rel}`;
}

/**
 * Dynamically import a route module.
 */
async function importRouteModule(filePath: string): Promise<RouteModule | null> {
  try {
    // Use pathToFileURL for cross-platform compatibility (Windows needs file:// URLs)
    const mod = await import(pathToFileURL(filePath).href);
    return mod as RouteModule;
  } catch (err) {
    console.error(`[voltx] Failed to import route: ${filePath}`, err);
    return null;
  }
}
