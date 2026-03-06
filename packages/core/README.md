<p align="center">
  <strong>@voltx/core</strong><br/>
  <em>Framework engine — config, plugins, app lifecycle</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/core"><img src="https://img.shields.io/npm/v/@voltx/core?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/core"><img src="https://img.shields.io/npm/dm/@voltx/core" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/core" alt="license" /></a>
</p>

---

The core engine of the [VoltX](https://github.com/codewithshail/voltx) framework. Provides `createApp()`, `defineConfig()`, plugin system, and app lifecycle management. Wires together server, AI, database, and auth into a single entry point.

## Installation

```bash
npm install @voltx/core
```

## Quick Start

```ts
// voltx.config.ts
import { defineConfig } from "@voltx/core";

export default defineConfig({
  name: "my-app",
  port: 3000,
  ai: { provider: "cerebras", model: "llama3.1-8b" },
  server: {
    routesDir: "src/routes",
    cors: true,
  },
});
```

```ts
// src/index.ts
import { createApp } from "@voltx/core";
import config from "../voltx.config";

const app = createApp(config);
app.start();
```

## API

### `defineConfig(config)`

Type-safe configuration helper. Merges your config with sensible defaults.

```ts
const config = defineConfig({
  name: "my-app",
  port: 3000,
  ai: { provider: "openai", model: "gpt-4o" },
  db: { url: process.env.DATABASE_URL },
  plugins: [myPlugin],
});
```

### `createApp(config)`

Creates a VoltX application instance with server, plugins, and lifecycle hooks.

```ts
const app = createApp(config);

// Register plugins
app.use({ name: "analytics", setup: (ctx) => { /* ... */ } });

// Graceful shutdown hooks
app.onShutdown(async () => { /* cleanup */ });

// Start the server
await app.start();
```

### `createLogger(prefix?)`

Creates a structured logger with `info`, `warn`, `error`, and `debug` methods.

```ts
const logger = createLogger("my-app");
logger.info("Server started");
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | `"voltx-app"` | Application name |
| `port` | `number` | `3000` | Server port |
| `ai` | `object` | — | AI provider config |
| `db` | `object` | — | Database config |
| `auth` | `object` | — | Auth config |
| `server` | `object` | — | Server overrides |
| `plugins` | `array` | `[]` | Plugin list |

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
