// @voltx/server — Vite Plugin for File-Based Routing
//
// Provides:
// 1. Virtual module "voltx/router" — auto-discovers src/pages/*.tsx
// 2. Supports nested layouts (layout.tsx), loading states (loading.tsx),
//    error boundaries (error.tsx), and not-found pages (not-found.tsx)
// 3. Auto-configures ssr.noExternal for react-router
// 4. HMR support — routes update when pages are added/removed
//
// Convention:
//   src/pages/index.tsx           → /
//   src/pages/about.tsx           → /about
//   src/pages/layout.tsx          → root layout (wraps all pages)
//   src/pages/loading.tsx         → root loading state
//   src/pages/error.tsx           → root error boundary
//   src/pages/not-found.tsx       → 404 page
//   src/pages/blog/layout.tsx     → layout for /blog/* routes
//   src/pages/blog/index.tsx      → /blog
//   src/pages/blog/[slug].tsx     → /blog/:slug
//   src/pages/blog/loading.tsx    → loading state for /blog/*
//   src/pages/blog/error.tsx      → error boundary for /blog/*

import type { Plugin } from "vite";

export interface VoltxRouterOptions {
  /** Directory to scan for page files (default: "src/pages") */
  pagesDir?: string;
}

/**
 * VoltX file-based router plugin for Vite.
 *
 * Scans `src/pages/` and generates a virtual module that maps
 * file paths to routes with nested layout support — like Next.js App Router.
 *
 * Usage:
 *   import { Link, VoltxRoutes, useNavigate } from "voltx/router";
 */
export function voltxRouter(options: VoltxRouterOptions = {}): Plugin {
  const pagesDir = options.pagesDir ?? "src/pages";

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
        return generateRouterModule(pagesDir);
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

function generateRouterModule(pagesDir: string): string {
  return `
import { createElement, Component, Suspense } from "react";
import { Routes, Route, Outlet } from "react-router";

// ─── Glob all files in pages directory ───────────────────────────────────────
const allFiles = import.meta.glob("/${pagesDir}/**/*.tsx", { eager: true });

// ─── Classify files by type ──────────────────────────────────────────────────
// Special files: layout.tsx, loading.tsx, error.tsx, not-found.tsx
// Page files: everything else (index.tsx, about.tsx, [slug].tsx, etc.)

const SPECIAL_FILES = new Set(["layout", "loading", "error", "not-found"]);

function classifyFiles() {
  const pages = {};      // dir → [{ routePath, Component }]
  const layouts = {};    // dir → Component
  const loadings = {};   // dir → Component
  const errors = {};     // dir → Component
  let notFound = null;   // global not-found component

  for (const [filePath, mod] of Object.entries(allFiles)) {
    const Component = mod.default;
    if (!Component) continue;

    // Get relative path from pages dir: "/src/pages/blog/index.tsx" → "blog/index.tsx"
    const rel = filePath.replace("/${pagesDir}/", "");
    const parts = rel.replace(/\\.tsx$/, "").split("/");
    const fileName = parts[parts.length - 1];
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

    if (fileName === "layout") {
      layouts[dir] = Component;
    } else if (fileName === "loading") {
      loadings[dir] = Component;
    } else if (fileName === "error") {
      errors[dir] = Component;
    } else if (fileName === "not-found") {
      if (dir === "") notFound = Component;
    } else {
      // It's a page file — compute route path
      let routePath = rel
        .replace(/\\.tsx$/, "")
        .replace(/(^|\\/)index$/, "$1")
        .replace(/\\[([^\\]]+)\\]/g, ":$1")
        .replace(/\\/$/, "");

      if (!routePath) routePath = "";

      if (!pages[dir]) pages[dir] = [];
      pages[dir].push({ routePath: "/" + routePath, Component });
    }
  }

  return { pages, layouts, loadings, errors, notFound };
}

const { pages, layouts, loadings, errors, notFound } = classifyFiles();

// ─── Error Boundary Component ────────────────────────────────────────────────
class VoltxErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Intentionally swallow — prevents error from propagating to window error handlers
    // (e.g. Vite's dev overlay) after React has already caught it.
    console.error("[voltx] Caught by error boundary:", error);
  }

  render() {
    if (this.state.hasError) {
      const reset = () => this.setState({ hasError: false, error: null });
      if (this.props.fallback) {
        return createElement(this.props.fallback, {
          error: this.state.error,
          reset,
        });
      }
      return createElement("div", { style: { padding: "2rem" } },
        createElement("h2", null, "Something went wrong"),
        createElement("button", { onClick: reset }, "Try again")
      );
    }
    return this.props.children;
  }
}

// ─── Build nested route tree ─────────────────────────────────────────────────
// Directories are sorted so parents come before children.
// Each directory with a layout.tsx becomes a layout route.
// Pages within that directory become its children.

function getAllDirs() {
  const dirs = new Set([""]);
  for (const dir of Object.keys(pages)) dirs.add(dir);
  for (const dir of Object.keys(layouts)) dirs.add(dir);
  for (const dir of Object.keys(loadings)) dirs.add(dir);
  for (const dir of Object.keys(errors)) dirs.add(dir);
  return Array.from(dirs).sort((a, b) => {
    if (a === "") return -1;
    if (b === "") return 1;
    return a.localeCompare(b);
  });
}

function getParentDir(dir) {
  if (dir === "") return null;
  const idx = dir.lastIndexOf("/");
  return idx === -1 ? "" : dir.substring(0, idx);
}

// Find the nearest ancestor directory that has a layout
function findLayoutAncestor(dir) {
  let current = getParentDir(dir);
  while (current !== null) {
    if (layouts[current]) return current;
    current = getParentDir(current);
  }
  return null;
}

// Wrap element with loading (Suspense) and error boundary if available for a dir
function wrapElement(element, dir) {
  let wrapped = element;
  if (errors[dir]) {
    wrapped = createElement(VoltxErrorBoundary, { fallback: errors[dir] }, wrapped);
  }
  if (loadings[dir]) {
    wrapped = createElement(Suspense, { fallback: createElement(loadings[dir]) }, wrapped);
  }
  return wrapped;
}

// ─── Layout wrapper component ────────────────────────────────────────────────
// Creates a layout component that wraps <Outlet /> with error/loading boundaries.
// The error boundary and suspense MUST wrap the Outlet (child content),
// not the layout itself — otherwise errors in child routes won't be caught.
function createLayoutElement(LayoutComp, dir) {
  function LayoutWrapper() {
    let outlet = createElement(Outlet);
    // Wrap the outlet (child content) with error boundary + suspense
    outlet = wrapElement(outlet, dir);
    return createElement(LayoutComp, null, outlet);
  }
  LayoutWrapper.displayName = "Layout(" + (dir || "root") + ")";
  return LayoutWrapper;
}

// ─── Generate the <Routes> tree ──────────────────────────────────────────────
function buildRouteElements() {
  const allDirs = getAllDirs();

  // Build a tree structure: each dir can have child routes and child layout dirs
  // dirChildren[dir] = array of Route elements (pages + nested layout routes)
  const dirChildren = {};
  for (const dir of allDirs) {
    dirChildren[dir] = [];
  }

  // First, add page routes to their directory
  for (const dir of allDirs) {
    const dirPages = pages[dir] || [];
    for (const { routePath, Component: PageComp } of dirPages) {
      // Compute the path relative to the directory's base
      const dirBase = dir ? "/" + dir : "";
      let relativePath = routePath;
      if (dirBase && relativePath.startsWith(dirBase)) {
        relativePath = relativePath.substring(dirBase.length);
      }
      if (relativePath.startsWith("/")) relativePath = relativePath.substring(1);

      const isIndex = relativePath === "";
      const routeProps = isIndex
        ? { index: true, element: createElement(PageComp), key: routePath }
        : { path: relativePath, element: createElement(PageComp), key: routePath };

      dirChildren[dir].push(createElement(Route, routeProps));
    }
  }

  // Now, nest directories bottom-up: child dirs become Route children of parent dirs
  // Process in reverse order (deepest first)
  const reversedDirs = allDirs.slice().reverse();

  for (const dir of reversedDirs) {
    if (dir === "") continue; // root handled last

    const parentDir = getParentDir(dir);
    if (parentDir === null) continue;

    const hasLayout = !!layouts[dir];
    const children = dirChildren[dir];

    // Compute path segment for this directory relative to parent
    const parentBase = parentDir ? parentDir + "/" : "";
    const segment = dir.startsWith(parentBase) ? dir.substring(parentBase.length) : dir;
    // Convert [param] to :param in segment
    const routeSegment = segment.replace(/\\[([^\\]]+)\\]/g, ":$1");

    if (hasLayout) {
      // This dir has a layout — create a layout route with children
      const LayoutWrapper = createLayoutElement(layouts[dir], dir);
      let layoutElement = createElement(LayoutWrapper);
      layoutElement = wrapElement(layoutElement, dir);

      const layoutRoute = createElement(
        Route,
        { path: routeSegment, element: layoutElement, key: "layout:" + dir },
        ...children
      );
      dirChildren[parentDir].push(layoutRoute);
    } else if (children.length > 0) {
      // No layout — just a path prefix grouping
      if (routeSegment) {
        const prefixRoute = createElement(
          Route,
          { path: routeSegment, key: "prefix:" + dir },
          ...children
        );
        dirChildren[parentDir].push(prefixRoute);
      } else {
        // Empty segment — push children directly
        dirChildren[parentDir].push(...children);
      }
    }
  }

  // Build root routes
  const rootChildren = dirChildren[""];

  // Add not-found catch-all at the end
  if (notFound) {
    rootChildren.push(
      createElement(Route, { path: "*", element: createElement(notFound), key: "not-found" })
    );
  }

  // If root has a layout, wrap everything in it
  if (layouts[""]) {
    const RootLayout = createLayoutElement(layouts[""], "");
    let rootElement = createElement(RootLayout);
    rootElement = wrapElement(rootElement, "");

    return createElement(
      Routes,
      null,
      createElement(Route, { path: "/", element: rootElement }, ...rootChildren)
    );
  }

  // No root layout — wrap with loading/error if present
  let routesElement = createElement(Routes, null, ...rootChildren);
  if (errors[""]) {
    routesElement = createElement(VoltxErrorBoundary, { fallback: errors[""] }, routesElement);
  }
  if (loadings[""]) {
    routesElement = createElement(Suspense, { fallback: createElement(loadings[""]) }, routesElement);
  }

  return routesElement;
}

// ─── Collect flat routes list (for backward compat) ──────────────────────────
function collectRoutes() {
  const result = [];
  for (const dirPages of Object.values(pages)) {
    for (const { routePath, Component } of dirPages) {
      result.push({ path: routePath, Component });
    }
  }
  return result;
}

const routes = collectRoutes();

export function VoltxRoutes() {
  return buildRouteElements();
}

export { routes };

// Navigation primitives — single import source
export { Link, NavLink, Outlet, useNavigate, useParams, useLocation, useSearchParams, useOutletContext } from "react-router";
`;
}
