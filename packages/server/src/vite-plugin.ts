// @voltx/server — Vite Plugin for File-Based Routing
//
// Provides:
// 1. Virtual module "voltx/router" — auto-discovers src/pages/*.tsx
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
 * Usage:
 *   import { Link, VoltxRoutes, useNavigate } from "voltx/router";
 *
 * Convention:
 *   src/pages/index.tsx       → /
 *   src/pages/about.tsx       → /about
 *   src/pages/blog/index.tsx  → /blog
 *   src/pages/blog/[slug].tsx → /blog/:slug
 */
export function voltxRouter(options: VoltxRouterOptions = {}): Plugin {
  const pagesDir = options.pagesDir ?? "src/pages";

  // "voltx/router" is the clean public import path
  // "virtual:voltx-routes" kept as legacy alias
  const PUBLIC_ID = "voltx/router";
  const LEGACY_ID = "virtual:voltx-routes";
  const RESOLVED_ID = "\0voltx/router";

  return {
    name: "voltx-router",
    enforce: "pre",

    config() {
      return {
        ssr: {
          noExternal: ["react-router"],
        },
      };
    },

    resolveId(id: string) {
      if (id === PUBLIC_ID || id === LEGACY_ID) {
        return RESOLVED_ID;
      }
    },

    load(id: string) {
      if (id === RESOLVED_ID) {
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

// Navigation primitives — single import source
export { Link, NavLink, useNavigate, useParams, useLocation, useSearchParams } from "react-router";
`;
      }
    },

    handleHotUpdate({ file, server }: { file: string; server: { moduleGraph: { getModuleById(id: string): unknown; invalidateModule(mod: unknown): void }; ws: { send(msg: { type: string }): void } } }) {
      if (file.includes(pagesDir.replace(/\//g, "/"))) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) {
          server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: "full-reload" });
        }
      }
    },
  };
}
