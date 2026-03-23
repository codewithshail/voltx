<p align="center">
  <strong>@voltx/cli</strong><br/>
  <em>CLI tools for the VoltX framework</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/cli"><img src="https://img.shields.io/npm/v/@voltx/cli?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/cli"><img src="https://img.shields.io/npm/dm/@voltx/cli" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/cli" alt="license" /></a>
</p>

---

Command-line tools for the [VoltX](https://github.com/codewithshail/voltx) framework. Full-stack dev server (Vite + Hono), production build with SSR, code generation, and project scaffolding.

## Installation

```bash
npm install @voltx/cli
```

## Commands

### Development

```bash
voltx dev          # Start Vite dev server with HMR + backend
voltx build        # Build for production (client + SSR + server)
voltx start        # Start production server
```

`voltx dev` starts a single process that serves both the React frontend and Hono API backend with hot module replacement. No separate frontend/backend servers needed.

### Create a New Project

```bash
voltx create my-app
voltx create my-app --template chatbot
voltx create my-app --template agent-app --shadcn
voltx create my-app --template rag-app --auth jwt
```

> For the full interactive experience with tool selection, RAG toggle, shadcn/ui, and API key management, use `npx create-voltx-app` instead.

### Code Generation

```bash
voltx generate route api/users      # New API route
voltx generate agent assistant       # New agent definition
voltx generate tool search           # New tool for agents
```

## Build Pipeline

`voltx build` runs a 3-phase build when SSR is detected:

1. **Client build** — Vite builds `src/entry-client.tsx` → `dist/client/`
2. **SSR build** — Vite builds `src/entry-server.tsx` → `dist/server/`
3. **Server build** — tsup bundles `server.ts` → `dist/index.js`

Falls back to a 2-phase build (client + server) if no `src/entry-server.tsx` exists.

## Project Structure

All templates generate a full-stack project with file-based routing:

```
my-app/
├── api/                    # Backend API routes (auto-discovered via voltx/api)
│   ├── index.ts            # GET /api — health check
│   ├── chat.ts             # POST /api/chat (chatbot/agent-app)
│   └── agent.ts            # POST /api/agent (agent-app)
├── src/
│   ├── pages/              # Frontend pages (auto-discovered via voltx/router)
│   │   └── index.tsx       # / — home page
│   ├── layout.tsx          # Root layout wrapper
│   ├── globals.css         # Tailwind CSS v4
│   ├── entry-client.tsx    # Client hydration
│   ├── entry-server.tsx    # SSR rendering
│   ├── voltx-env.d.ts     # Type declarations for voltx/router & voltx/api
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   └── lib/                # Utilities (cn() if shadcn enabled)
├── agents/                 # AI agents (agent-app)
├── tools/                  # Agent tools (agent-app)
├── public/                 # Static assets (favicon, robots.txt, manifest)
├── server.ts               # Hono app entry
├── vite.config.ts          # Vite + Tailwind + voltxRouter() + voltxAPI()
├── components.json         # shadcn/ui config (if enabled)
├── voltx.config.ts         # VoltX config
└── tsconfig.json           # TypeScript (with @/* path alias)
```

## What's Included

- **File-based page routing** — `src/pages/*.tsx` auto-discovered via `voltxRouter()` Vite plugin
- **File-based API routing** — `api/**/*.ts` auto-discovered via `voltxAPI()` Vite plugin
- **Navigation** — `Link`, `NavLink`, `useNavigate`, `useParams` from `voltx/router`
- **Tailwind CSS v4** — native Vite plugin, no PostCSS config needed
- **Path aliases** — `@/*` maps to `src/*` in both TypeScript and Vite
- **shadcn/ui** (optional) — `--shadcn` flag pre-configures `components.json`, `cn()` utility, and CSS variables
- **React SSR** — streaming server-side rendering via `@voltx/server`
- **Auto .env loading** — `@voltx/core` loads `.env` files automatically

## Programmatic Usage

```ts
import { createProject } from "@voltx/cli";

await createProject({
  name: "my-app",
  template: "chatbot",
  auth: "jwt",
  shadcn: true,
});
```

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
