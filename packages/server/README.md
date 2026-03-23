<p align="center">
  <strong>@voltx/server</strong><br/>
  <em>Hono-based HTTP server with file-based routing, React SSR, and Vite plugins</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/server"><img src="https://img.shields.io/npm/v/@voltx/server?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/server"><img src="https://img.shields.io/npm/dm/@voltx/server" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/server" alt="license" /></a>
</p>

---

The HTTP layer of the [VoltX](https://github.com/codewithshail/voltx) framework. Built on [Hono](https://hono.dev) with file-based page routing, file-based API routing, React SSR (streaming), CORS, logging, error handling, and static file serving.

## Installation

```bash
npm install @voltx/server
```

## Quick Start

```ts
// server.ts
import { Hono } from "hono";
import { registerSSR } from "@voltx/server";
import { registerRoutes } from "voltx/api";

const app = new Hono();

// Auto-discover and mount all API routes from api/ directory
registerRoutes(app);

// SSR — renders React on the server, hydrates on the client
registerSSR(app, null, {
  title: "My App",
  entryServer: "src/entry-server.tsx",
  entryClient: "src/entry-client.tsx",
  css: "src/globals.css",
});

export default app;
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { voltxRouter, voltxAPI } from "@voltx/server";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    voltxRouter(),   // File-based page routing → voltx/router
    voltxAPI(),      // File-based API routing → voltx/api
    devServer({ entry: "server.ts" }),
  ],
});
```

## Vite Plugins

### `voltxRouter()` — File-Based Page Routing

Auto-discovers React components in `src/pages/` and provides the `voltx/router` virtual module.

```
src/pages/index.tsx         → /
src/pages/about.tsx         → /about
src/pages/blog/index.tsx    → /blog
src/pages/blog/[slug].tsx   → /blog/:slug (dynamic route)
```

```tsx
// Use in entry-client.tsx and entry-server.tsx
import { VoltxRoutes, Link, useNavigate, useParams } from "voltx/router";

// VoltxRoutes renders the matched page component
// Link, NavLink, useNavigate, useParams, useLocation, useSearchParams
// are re-exported from react-router — no separate install needed
```

#### Options

```ts
voltxRouter({
  pagesDir: "src/pages",  // default: "src/pages"
})
```

### `voltxAPI()` — File-Based API Routing

Auto-discovers API route files in `api/` and provides the `voltx/api` virtual module.

```
api/index.ts              → /api
api/users.ts              → /api/users
api/users/[id].ts         → /api/users/:id
api/[...slug].ts          → /api/* (catch-all)
```

Each file exports named HTTP method handlers:

```ts
// api/users.ts
import type { Context } from "@voltx/server";

export function GET(c: Context) {
  return c.json([{ id: 1, name: "Alice" }]);
}

export async function POST(c: Context) {
  const body = await c.req.json();
  return c.json({ created: true }, 201);
}
```

Supported methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.

Routes are sorted automatically: static first, dynamic (`:param`) second, catch-all (`*`) last. HMR support means new files are picked up instantly in dev mode.

#### Options

```ts
voltxAPI({
  apiDir: "api",  // default: "api"
})
```

#### Usage in server.ts

```ts
import { registerRoutes } from "voltx/api";

// Mounts all discovered API handlers on the Hono app
const registered = registerRoutes(app);
// → [{ method: "GET", path: "/api" }, { method: "POST", path: "/api/users" }, ...]
```

## Server-Side Rendering

`registerSSR()` provides streaming React SSR with zero config:

- **Dev mode** — works with `@hono/vite-dev-server` for HMR
- **Production** — reads the Vite client manifest for hashed asset paths, serves pre-built SSR bundle
- **Streaming** — uses `renderToReadableStream` for fast TTFB
- **CSS injection** — injects your global CSS in dev mode to prevent FOUC
- **Public env** — injects `window.__VOLTX_ENV__` for `VITE_*` variables

```ts
import { registerSSR } from "@voltx/server";

registerSSR(app, viteInstance, {
  title: "My App",
  entryServer: "src/entry-server.tsx",
  entryClient: "src/entry-client.tsx",
  css: "src/globals.css",
});
```

| Option | Type | Description |
|--------|------|-------------|
| `title` | `string` | HTML `<title>` |
| `entryServer` | `string` | Path to SSR entry (exports `render()`) |
| `entryClient` | `string` | Path to client hydration entry |
| `css` | `string` | Path to global CSS file (prevents FOUC in dev) |

## Features

- **Vite plugins** — `voltxRouter()` and `voltxAPI()` for Next.js-style file-based routing
- **Virtual modules** — `voltx/router` and `voltx/api` for clean imports
- **React SSR** — streaming server-side rendering with `registerSSR()`
- **Navigation** — `Link`, `NavLink`, `useNavigate`, `useParams` from `voltx/router`
- **Dynamic routes** — `[param]` and `[...slug]` catch-all for both pages and API
- **HMR** — new pages and API files are picked up instantly in dev mode
- **Built-in middleware** — CORS, request logging, error handling
- **Static file serving** — `public/` directory (favicon, robots.txt, manifest)
- **Full Hono access** — use any Hono middleware or plugin

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
