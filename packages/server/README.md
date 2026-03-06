<p align="center">
  <strong>@voltx/server</strong><br/>
  <em>Hono-based HTTP server with file-based routing and SSE streaming</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/server"><img src="https://img.shields.io/npm/v/@voltx/server?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/server"><img src="https://img.shields.io/npm/dm/@voltx/server" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/server" alt="license" /></a>
</p>

---

The HTTP layer of the [VoltX](https://github.com/codewithshail/voltx) framework. Built on [Hono](https://hono.dev) with file-based routing (Next.js-style), CORS, logging, error handling, and static file serving out of the box.

## Installation

```bash
npm install @voltx/server
```

## Quick Start

```ts
import { createServer } from "@voltx/server";

const server = createServer({
  port: 3000,
  routesDir: "src/routes",
  cors: true,
  logger: true,
});

await server.start();
// ⚡ VoltX server running at http://localhost:3000
```

## File-Based Routing

Drop files in `src/routes/` and they become API endpoints automatically:

```
src/routes/index.ts           → GET /
src/routes/api/chat.ts        → POST /api/chat
src/routes/api/users/[id].ts  → GET /api/users/:id
src/routes/api/[...slug].ts   → /api/* (catch-all)
```

Each file exports HTTP method handlers:

```ts
// src/routes/api/chat.ts
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

- **File-based routing** — Next.js-style, zero config
- **Dynamic routes** — `[param]` → `:param`, `[...slug]` → catch-all
- **Built-in middleware** — CORS, request logging, error handling
- **Static file serving** — Serves from `public/` directory
- **Per-route middleware** — Export `middleware` from any route file
- **Graceful shutdown** — Clean server stop with `server.stop()`
- **Full Hono access** — `server.app` gives you the raw Hono instance

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `3000` | Server port |
| `hostname` | `string` | `"0.0.0.0"` | Bind address |
| `routesDir` | `string` | `"src/routes"` | Routes directory |
| `staticDir` | `string` | `"public"` | Static files directory |
| `cors` | `boolean \| object` | `true` | CORS configuration |
| `logger` | `boolean` | `true` (dev) | Request logging |

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
