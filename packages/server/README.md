<p align="center">
  <strong>@voltx/server</strong><br/>
  <em>Hono-based HTTP server with file-based routing, SSR, and SSE streaming</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/server"><img src="https://img.shields.io/npm/v/@voltx/server?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/server"><img src="https://img.shields.io/npm/dm/@voltx/server" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/server" alt="license" /></a>
</p>

---

The HTTP layer of the [VoltX](https://github.com/codewithshail/voltx) framework. Built on [Hono](https://hono.dev) with file-based routing, React SSR (streaming), CORS, logging, error handling, and static file serving.

## Installation

```bash
npm install @voltx/server
```

## Quick Start

```ts
import { Hono } from "hono";
import { registerSSR } from "@voltx/server";

const app = new Hono();

// API routes
app.get("/api", (c) => c.json({ status: "ok" }));

// SSR — renders React on the server, hydrates on the client
registerSSR(app, null, {
  title: "My App",
  entryServer: "src/entry-server.tsx",
  entryClient: "src/entry-client.tsx",
});

export default app;
```

## Server-Side Rendering

`registerSSR()` provides streaming React SSR with zero config:

- **Dev mode** — works with `@hono/vite-dev-server` for HMR
- **Production** — reads the Vite client manifest for hashed asset paths, serves pre-built SSR bundle
- **Streaming** — uses `renderToReadableStream` for fast TTFB
- **Public env** — injects `window.__VOLTX_ENV__` for `VITE_*` variables

```ts
import { registerSSR } from "@voltx/server";

registerSSR(app, viteInstance, {
  title: "My App",
  entryServer: "src/entry-server.tsx",
  entryClient: "src/entry-client.tsx",
});
```

| Option | Type | Description |
|--------|------|-------------|
| `title` | `string` | HTML `<title>` |
| `entryServer` | `string` | Path to SSR entry (exports `render()`) |
| `entryClient` | `string` | Path to client hydration entry |

## File-Based Routing

Drop files in `api/` and they become API endpoints:

```
api/index.ts              → GET /api
api/chat.ts               → POST /api/chat
api/users/[id].ts         → GET /api/users/:id
api/rag/query.ts          → POST /api/rag/query
```

Each file exports HTTP method handlers:

```ts
import type { Context } from "@voltx/server";

export async function POST(c: Context) {
  const body = await c.req.json();
  return c.json({ message: "Hello!" });
}

export function GET(c: Context) {
  return c.json({ status: "ok" });
}
```

## Features

- **React SSR** — streaming server-side rendering with `registerSSR()`
- **File-based routing** — Next.js-style `api/` directory
- **Dynamic routes** — `[param]` and `[...slug]` catch-all
- **Built-in middleware** — CORS, request logging, error handling
- **Static file serving** — `public/` directory (favicon, robots.txt, manifest)
- **Full Hono access** — use any Hono middleware or plugin

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
