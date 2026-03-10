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

      if (vite) {
        // Development with explicit Vite instance: load module through Vite (with HMR)
        const mod = await vite.ssrLoadModule(entryServer);
        render = mod.render as (url: string) => Promise<ReadableStream>;
      } else if (process.env.NODE_ENV === "production") {
        // Production: load pre-built SSR bundle
        const ssrBundlePath = resolve(process.cwd(), "dist/server/entry-server.js");
        const mod = await import(ssrBundlePath);
        render = mod.render as (url: string) => Promise<ReadableStream>;
      } else {
        // Development under @hono/vite-dev-server: dynamic import is
        // intercepted by Vite's module graph, giving us HMR for free
        const mod = await import(/* @vite-ignore */ resolve(process.cwd(), entryServer));
        render = mod.render as (url: string) => Promise<ReadableStream>;
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
