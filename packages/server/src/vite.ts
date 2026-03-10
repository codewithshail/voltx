// @voltx/server — Vite dev server integration
// Embeds Vite inside Hono for unified full-stack development.
// One process, one port — frontend HMR + backend API routes together.

export interface ViteDevOptions {
  /** Project root directory (default: process.cwd()) */
  root?: string;
  /** Hono server entry file (default: src/index.ts) */
  entry?: string;
  /** Frontend entry for client-side hydration */
  entryClient?: string;
  /** Frontend entry for SSR rendering */
  entryServer?: string;
}

/**
 * Create a Vite config for full-stack development with Hono.
 *
 * Uses @hono/vite-dev-server to embed Vite inside Hono.
 * The Hono app handles API routes, Vite handles frontend assets + HMR.
 *
 * This function returns a Vite config object that can be written to
 * a temporary vite.config.ts or passed to Vite's createServer API.
 */
export function createViteDevConfig(options: ViteDevOptions = {}) {
  const {
    root = process.cwd(),
    entry = "src/index.ts",
  } = options;

  return {
    root,
    server: {
      // Let Hono handle the port — Vite runs in middleware mode via the plugin
      hmr: true,
    },
    plugins: [], // Plugins are added dynamically when starting
    // Externalize Node.js packages for SSR
    ssr: {
      external: ["react", "react-dom"],
    },
    entry,
  };
}
