// @voltx/server — Vite Plugin for File-Based Routing
//
// Provides:
// 1. Virtual module "virtual:voltx-routes" — auto-discovers src/pages/*.tsx
// 2. Auto-configures ssr.noExternal for react-router
// 3. HMR support — routes update when pages are added/removed

import type { Plugin } from "vite";

export interface VoltxRouterOptions {
  /** Directory to scan for page files (default: "src/pages") */
  pagesDir?: string;
}

/**
 * VoltX file-based router plugin for Vite.
 *
 * Scans `src/pages/` and generates a virtual module that maps
 * file paths to routes — just like Next.js.
 *
 * Convention:
 *   src/pages/index.tsx       → /
 *   src/pages/about.tsx       → /about
 *   src/pages/blog/index.tsx  → /blog
 *   src/pages/blog/[slug].tsx → /blog/:slug
 */
export function voltxRouter(options: VoltxRouterOptions = {}): Plugin {
  const pagesDir = options.pagesDir ?? "src/pages";
  const virtualModuleId = "virtual:voltx-routes";
  const resolvedVirtualModuleId = "\0" + virtualModuleId;

  return {
    name: "voltx-router",
    enforce: "pre",

    config() {
      return {
        ssr: {
          // react-router ships CJS — force Vite to bundle its .mjs for SSR
          noExternal: ["react-router"],
        },
      };
    },

    resolveId(id: string) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },

    load(id: string) {
      if (id === resolvedVirtualModuleId) {
        // Generate the routes module using import.meta.glob
        // Uses React.createElement instead of JSX to avoid needing a JSX transform
        // on the virtual module (Vite treats virtual modules as plain JS)
        return `
import { createElement } from "react";
import { Routes, Route } from "react-router";

const pages = import.meta.glob("/${pagesDir}/**/*.tsx", { eager: true });

function buildRoutes() {
  const routes = [];
  for (const [filePath, mod] of Object.entries(pages)) {
    const Component = mod.default;
    if (!Component) continue;

    let routePath = filePath
      .replace("/${pagesDir}", "")
      .replace(/\\.tsx$/, "")
      .replace(/\\/index$/, "/")
      .replace(/\\[([^\\]]+)\\]/g, ":$1");

    if (!routePath.startsWith("/")) routePath = "/" + routePath;
    if (routePath !== "/" && routePath.endsWith("/")) {
      routePath = routePath.slice(0, -1);
    }

    routes.push({ path: routePath, Component });
  }
  return routes;
}

const routes = buildRoutes();

export function VoltxRoutes() {
  return createElement(
    Routes,
    null,
    routes.map(({ path, Component }) =>
      createElement(Route, { key: path, path, element: createElement(Component) })
    )
  );
}

export { routes };
`;
      }
    },

    // HMR: when a file in src/pages/ is added/removed, invalidate the virtual module
    handleHotUpdate({ file, server }: { file: string; server: { moduleGraph: { getModuleById(id: string): unknown; invalidateModule(mod: unknown): void }; ws: { send(msg: { type: string }): void } } }) {
      if (file.includes(pagesDir.replace(/\//g, "/"))) {
        const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: "full-reload" });
        }
      }
    },
  };
}
