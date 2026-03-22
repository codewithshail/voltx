// @voltx/server — SSR Bridge
// Renders React components on the server, streams HTML to the browser,
// and hydrates on the client. Uses React 18 renderToReadableStream for streaming SSR.

import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import type { Hono } from "hono";

export interface SSROptions {
  /** Path to entry-server module (default: src/entry-server.tsx) */
  entryServer?: string;
  /** Path to entry-client module (default: src/entry-client.tsx) */
  entryClient?: string;
  /** App title (default: "VoltX App") */
  title?: string;
  /**
   * Custom module loader for dev mode (when no explicit Vite instance is passed).
   * This should be a function that calls `import()` from the caller's module context
   * so that Vite's SSR pipeline can intercept and transform .tsx files.
   * Example: `loadModule: (path) => import(path)`
   */
  loadModule?: (path: string) => Promise<Record<string, unknown>>;
  /**
   * Pre-loaded render function. When provided, skips all module loading
   * and uses this function directly. Useful when the caller imports the
   * entry-server module themselves (e.g. in Vite-processed server.ts).
   */
  render?: (url: string) => Promise<ReadableStream>;
  /**
   * CSS file path(s) to inject in dev mode `<head>`.
   * In dev, Vite serves source CSS and transforms it on the fly, but the
   * SSR HTML shell has no `<link>` tag — CSS only loads after client JS
   * hydrates, causing a flash of unstyled content (FOUC).
   *
   * Pass a string (e.g. `"src/globals.css"`) or an array of paths.
   * Each path is emitted as `<link rel="stylesheet" href="/path">`.
   * Defaults to `["src/globals.css"]`.
   */
  css?: string | string[];
}

/** Vite dev server shape — minimal interface to avoid hard dep on vite */
interface ViteDevServer {
  ssrLoadModule(url: string): Promise<Record<string, unknown>>;
  ssrFixStacktrace(e: Error): void;
}

/** Vite manifest entry shape */
interface ManifestEntry {
  file: string;
  css?: string[];
  imports?: string[];
}

/** Get VOLTX_PUBLIC_* env vars safe for browser injection */
function getPublicEnv(): Record<string, string> {
  const publicEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("VOLTX_PUBLIC_") && value !== undefined) {
      publicEnv[key] = value;
    }
  }
  return publicEnv;
}

/**
 * Register SSR catch-all handler on a Hono app.
 * Must be registered AFTER API routes — it catches all non-API GET requests
 * and renders the React app server-side with streaming.
 *
 * In dev: loads entry-server via Vite's ssrLoadModule (HMR-aware).
 * In prod: loads pre-built SSR bundle + reads Vite manifest for asset paths.
 */
export function registerSSR(
  app: Hono,
  vite: ViteDevServer | null,
  options: SSROptions = {},
): void {
  const entryServer = options.entryServer ?? "src/entry-server.tsx";
  const entryClient = options.entryClient ?? "src/entry-client.tsx";
  const title = options.title ?? "VoltX App";

  // Cache production manifest
  let manifest: Record<string, ManifestEntry> | null = null;

  app.get("*", async (c) => {
    const url = new URL(c.req.url, "http://localhost").pathname;

    // Skip API routes, static assets, and Vite internals
    if (
      url.startsWith("/api/") ||
      url.startsWith("/assets/") ||
      url.startsWith("/@") ||
      url.startsWith("/node_modules/") ||
      url.includes(".")
    ) {
      return c.notFound();
    }

    try {
      let render: (url: string) => Promise<ReadableStream>;

      if (options.render) {
        // Caller provided a render function directly — use it as-is
        render = options.render;
      } else if (vite) {
        // Development with explicit Vite instance
        const mod = await vite.ssrLoadModule(entryServer);
        render = mod.render as (url: string) => Promise<ReadableStream>;
      } else if (process.env.NODE_ENV === "production") {
        // Production: load pre-built SSR bundle
        const ssrBundlePath = resolve(process.cwd(), "dist/server/entry-server.js");
        const mod = await import(ssrBundlePath);
        render = mod.render as (url: string) => Promise<ReadableStream>;
      } else {
        // Development under @hono/vite-dev-server: the Vite instance is
        // injected into c.env by the plugin. Try multiple access patterns
        // since different versions of the plugin expose it differently.
        // Base env from the plugin: { incoming: req, outgoing: res }
        const envRecord = c.env as Record<string, unknown> | undefined;

        // Try to find the Vite dev server from the Node.js HTTP server
        // The plugin sets env.incoming to the Node.js IncomingMessage
        const incoming = envRecord?.incoming as { socket?: { server?: { _viteDevServer?: ViteDevServer } } } | undefined;
        const viteFromSocket = incoming?.socket?.server?._viteDevServer;

        // Also try direct env patterns from various plugin versions
        const viteFromEnv =
          (envRecord?.vite as ViteDevServer | undefined) ??
          (envRecord?.VITE_DEV_SERVER as ViteDevServer | undefined) ??
          viteFromSocket;

        if (viteFromEnv?.ssrLoadModule) {
          const mod = await viteFromEnv.ssrLoadModule(entryServer);
          render = mod.render as (url: string) => Promise<ReadableStream>;
        } else if (options.loadModule) {
          const mod = await options.loadModule(entryServer);
          render = mod.render as (url: string) => Promise<ReadableStream>;
        } else {
          // Under @hono/vite-dev-server, this module (server.ts) is loaded
          // via Vite's ssrLoadModule, so dynamic import() is intercepted by
          // Vite and can handle .tsx files. Use it as a direct fallback.
          try {
            const mod = await import(/* @vite-ignore */ entryServer);
            render = mod.render as (url: string) => Promise<ReadableStream>;
          } catch {
            // Last resort: try to create a Vite instance for SSR transformation.
            try {
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore — vite is a peer/dev dependency, available at runtime in user projects
              const { createServer: createViteServer } = await import("vite");
              const devServer = await createViteServer({
                server: { middlewareMode: true, hmr: false },
                appType: "custom",
              });
              const mod = await devServer.ssrLoadModule(entryServer);
              render = mod.render as (url: string) => Promise<ReadableStream>;
            } catch {
              throw new Error(
                `[voltx] Cannot load "${entryServer}" — Node.js cannot import .tsx files directly. ` +
                `Ensure @hono/vite-dev-server is configured or pass a loadModule/render option to registerSSR().`
              );
            }
          }
        }
      }

      const appStream = await render(url);
      const publicEnv = getPublicEnv();

      // Resolve asset paths
      let clientScript: string;
      let cssLinks = "";
      const isProd = process.env.NODE_ENV === "production";

      if (!isProd) {
        // Dev: Vite serves source files directly
        clientScript = `/${entryClient}`;

        // Inject CSS <link> tags so styles load before JS hydration (no FOUC)
        const cssPaths = options.css
          ? (Array.isArray(options.css) ? options.css : [options.css])
          : ["src/globals.css"];
        cssLinks = cssPaths
          .map((p) => `    <link rel="stylesheet" href="/${p}" />`)
          .join("\n");
      } else {
        // Production: read Vite manifest for hashed filenames
        if (!manifest) {
          const manifestPath = resolve(process.cwd(), "dist/client/.vite/manifest.json");
          if (existsSync(manifestPath)) {
            manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
          }
        }

        const entry = manifest?.[entryClient];
        clientScript = entry ? `/${entry.file}` : "/assets/entry-client.js";

        // Collect CSS files
        if (entry?.css) {
          cssLinks = entry.css
            .map((css) => `    <link rel="stylesheet" href="/${css}" />`)
            .join("\n");
        }
      }

      // Build the HTML shell
      const htmlHead = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="manifest" href="/site.webmanifest" />
  <meta name="theme-color" content="#0a0a0a" />
${!isProd ? '  <script type="module" src="/@vite/client"></script>' : ""}
${cssLinks}
  <script>window.__VOLTX_ENV__ = ${JSON.stringify(publicEnv)}</script>
</head>
<body>
  <div id="root">`;

      const htmlTail = `</div>
  <script type="module" src="${clientScript}"></script>
</body>
</html>`;

      // Stream: HTML head → React app stream → HTML tail
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Pipe everything asynchronously
      (async () => {
        try {
          await writer.write(encoder.encode(htmlHead));

          const reader = appStream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }

          await writer.write(encoder.encode(htmlTail));
        } catch (err) {
          console.error("[voltx] SSR stream error:", err);
        } finally {
          await writer.close();
        }
      })();

      return new Response(readable, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      // In dev, let Vite fix the stack trace
      if (vite) vite.ssrFixStacktrace(err as Error);
      console.error("[voltx] SSR render error:", err);
      return c.text("Internal Server Error", 500);
    }
  });
}
