// @voltx/server — Vite Plugin for File-Based API Routes
//
// Provides:
// 1. Virtual module "voltx/api" — auto-discovers api/**/*.ts
// 2. Exports registerRoutes(app) that mounts all handlers on Hono
// 3. HMR support — routes update when API files are added/removed
//
// Convention:
//   api/index.ts             → GET/POST/PUT/DELETE /api
//   api/users.ts             → GET/POST/PUT/DELETE /api/users
//   api/users/[id].ts        → GET/POST/PUT/DELETE /api/users/:id
//   api/rag/ingest.ts        → GET/POST/PUT/DELETE /api/rag/ingest
//
// Each file exports named HTTP method handlers: GET, POST, PUT, DELETE, PATCH

import type { Plugin } from "vite";

export interface VoltxAPIOptions {
  /** Directory to scan for API route files (default: "api") */
  apiDir?: string;
}

/**
 * VoltX file-based API routing plugin for Vite.
 *
 * Usage in server.ts:
 *   import { registerRoutes } from "voltx/api";
 *   registerRoutes(app);
 *
 * Convention:
 *   api/index.ts       → /api
 *   api/users.ts       → /api/users
 *   api/users/[id].ts  → /api/users/:id
 */
export function voltxAPI(options: VoltxAPIOptions = {}): Plugin {
  const apiDir = options.apiDir ?? "api";

  const PUBLIC_ID = "voltx/api";
  const RESOLVED_ID = "\0voltx/api";

  return {
    name: "voltx-api",
    enforce: "pre",

    resolveId(id: string) {
      if (id === PUBLIC_ID) {
        return RESOLVED_ID;
      }
    },

    load(id: string) {
      if (id === RESOLVED_ID) {
        // Generate a module that:
        // 1. Uses import.meta.glob to discover all API route files
        // 2. Exports registerRoutes(app) that mounts them on Hono
        return `
const modules = import.meta.glob("/${apiDir}/**/*.ts", { eager: true });

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

function fileToRoute(filePath) {
  let route = filePath
    .replace("/${apiDir}", "/${apiDir}")
    .replace(/\\.ts$/, "")
    .replace(/\\/index$/, "");

  // Convert [param] -> :param
  route = route.replace(/\\[([^\\]\\.]+)\\]/g, ":$1");
  // Convert [...slug] -> *
  route = route.replace(/\\[\\.\\.\\.([^\\]]+)\\]/g, "*");

  if (!route || route === "/${apiDir}") route = "/${apiDir}";
  return route;
}

export function registerRoutes(app) {
  const registered = [];

  // Sort: static routes first, dynamic (:param) second, catch-all (*) last
  const entries = Object.entries(modules).sort(([a], [b]) => {
    const ra = fileToRoute(a);
    const rb = fileToRoute(b);
    const sa = ra.includes("*") ? 2 : ra.includes(":") ? 1 : 0;
    const sb = rb.includes("*") ? 2 : rb.includes(":") ? 1 : 0;
    if (sa !== sb) return sa - sb;
    return ra.localeCompare(rb);
  });

  for (const [filePath, mod] of entries) {
    const route = fileToRoute(filePath);

    for (const method of HTTP_METHODS) {
      const handler = mod[method];
      if (typeof handler === "function") {
        app.on(method, route, handler);
        registered.push({ method, path: route });
      }
    }
  }

  return registered;
}

export { modules as apiModules };
`;
      }
    },

    // HMR: when a file in api/ is added/removed, invalidate the virtual module
    handleHotUpdate({ file, server }: { file: string; server: { moduleGraph: { getModuleById(id: string): unknown; invalidateModule(mod: unknown): void }; ws: { send(msg: { type: string }): void } } }) {
      if (file.includes(`/${apiDir}/`) || file.endsWith(`/${apiDir}`)) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: "full-reload" });
        }
      }
    },
  };
}
