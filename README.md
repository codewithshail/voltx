<p align="center">
  <img src="https://img.shields.io/badge/⚡-VoltX-blueviolet?style=for-the-badge&labelColor=000" alt="VoltX" />
</p>

<p align="center">
  <strong>The AI-first full-stack TypeScript framework</strong><br/>
  <em>Server + AI + Agents + RAG + DB + Auth + Memory + React SSR — all wired together</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/org/voltx"><img src="https://img.shields.io/npm/v/@voltx/core?label=%40voltx%2Fcore&color=blue" alt="npm" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/core?color=green" alt="license" /></a>
  <a href="https://github.com/codewithshail/voltx"><img src="https://img.shields.io/github/stars/codewithshail/voltx?style=social" alt="stars" /></a>
</p>

<p align="center">
  <a href="https://voltx.co.in">Documentation</a> · <a href="https://github.com/codewithshail/voltx/issues">Issues</a> · <a href="https://buymeacoffee.com/promptlyai">Support Us ☕</a>
</p>

---

## What is VoltX?

VoltX is a full-stack TypeScript framework purpose-built for AI applications. Instead of wiring together 10 different packages, you get one framework where everything works out of the box — LLM providers, streaming, agents, RAG pipelines, database, auth, conversation memory, React SSR, and Tailwind CSS.

One command. Full-stack. Everything runs.

```bash
npx create-voltx-app my-app
cd my-app
npm run dev
# ⚡ Open http://localhost:5173 — full-stack app with SSR
```

```ts
// api/chat.ts — streaming chat endpoint
import type { Context } from "@voltx/server";
import { streamText } from "@voltx/ai";

export async function POST(c: Context) {
  const { messages } = await c.req.json();
  const result = await streamText({
    model: "cerebras:llama3.1-8b",
    messages,
  });
  return result.toSSEResponse();
}
```

---

## Why VoltX?

Building AI apps today means stitching together a dozen libraries. VoltX replaces all of that with a single integrated framework.

| What you need | Without VoltX | With VoltX |
|---------------|---------------|------------|
| LLM calls | Vercel AI SDK / LangChain | `@voltx/ai` — built in |
| HTTP server | Express / Fastify / Hono | `@voltx/server` — built in |
| API routing | Manual setup | File-based routing (automatic) |
| React SSR | Next.js / Remix | `@voltx/server` — streaming SSR |
| Frontend | Separate Vite project | Integrated — one `npm run dev` |
| CSS | Manual Tailwind setup | Tailwind CSS v4 — pre-configured |
| Component library | Install + configure shadcn | Optional toggle during scaffolding |
| Database | Drizzle + manual setup | `@voltx/db` — configured |
| Vector search | Pinecone SDK + glue code | `@voltx/db` — integrated |
| AI agents | Mastra / LangChain agents | `@voltx/agents` — built in |
| RAG pipeline | Custom code | `@voltx/rag` — built in |
| Conversation memory | Build it yourself | `@voltx/memory` — built in |
| Auth | Better Auth / NextAuth | `@voltx/auth` — built in |
| React hooks | Custom hooks | `@voltx/ui` — built in |
| CLI tooling | Custom scripts | `@voltx/cli` — built in |

---

## Quick Start

### Create a New Project

```bash
# Interactive setup — walks you through everything
npx create-voltx-app my-app

# Non-interactive with defaults
npx create-voltx-app my-app --template chatbot --yes
```

### Interactive Flow

```
 1. Project name
 2. Template (chatbot, RAG app, agent app, or blank)
 3. AI provider (Cerebras, OpenAI, Anthropic, Google, OpenRouter, Ollama)
 4. Agent tools (agent-app only — multi-select)
 5. Enable RAG? (chatbot/agent-app toggle)
 6. Embedding provider (if needed)
 7. Auth strategy (Better Auth, JWT, or none)
 8. Include shadcn/ui? (pre-configured component library)
 9. Package manager (npm, pnpm, yarn, bun)
10. API keys — enter now or skip
11. Install dependencies
12. Initialize git
```

```bash
cd my-app
npm run dev
# ⚡ Full-stack app running at http://localhost:5173
```

### Templates

| Template | What you get | Frontend |
|----------|-------------|----------|
| `chatbot` | Streaming chat + memory, optional RAG | Chat interface with streaming bubbles |
| `rag-app` | Document Q&A with embeddings + vector search | Split view: ingest panel + query chat |
| `agent-app` | AI agent with tools + memory, optional RAG | Chat with tool step visualization |
| `blank` | Minimal server with file-based routing | React welcome page |

Every template is full-stack: React frontend with streaming SSR + Hono backend. One `npm run dev` starts everything — like Next.js, but for AI apps.

---

## Project Structure

```
my-app/
├── api/                    # Backend API routes (file-based routing)
│   ├── index.ts            # GET /api — health check
│   ├── chat.ts             # POST /api/chat
│   └── agent.ts            # POST /api/agent
├── src/                    # Frontend (React + Vite)
│   ├── app.tsx             # Root component
│   ├── layout.tsx          # Layout wrapper
│   ├── globals.css         # Tailwind CSS v4 + theme
│   ├── entry-client.tsx    # Client hydration
│   ├── entry-server.tsx    # SSR rendering
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   └── lib/                # Utilities
├── agents/                 # AI agents (agent-app)
├── tools/                  # Agent tools (agent-app)
├── public/                 # Static assets (favicon, robots.txt, manifest)
├── server.ts               # Hono app entry
├── vite.config.ts          # Vite + Tailwind + dev server
├── components.json         # shadcn/ui config (if enabled)
├── voltx.config.ts         # VoltX config
└── tsconfig.json           # TypeScript (with @/* path alias)
```

**Where to add things:**
- New API route → create a file in `api/` (e.g. `api/users.ts`)
- New React component → `src/components/`
- New page/view → edit `src/app.tsx` or add routing
- New agent tool → `tools/`
- New agent → `agents/`
- Static files → `public/`

---

## Built-in Features

### Tailwind CSS v4

Pre-configured with the native `@tailwindcss/vite` plugin. No PostCSS config, no `tailwind.config.js`. Just works.

```css
/* src/globals.css */
@import "tailwindcss";

@theme {
  --color-background: #0a0a0a;
  --color-foreground: #ededed;
  --color-primary: #2563eb;
}
```

### Path Aliases

`@/*` maps to `src/*` in both TypeScript and Vite:

```tsx
import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
```

### shadcn/ui (Optional)

Toggle during scaffolding or use `--shadcn` flag. Pre-configures:
- `components.json` (new-york style, Tailwind v4)
- `src/lib/utils.ts` with `cn()` helper
- HSL CSS variables for theming

Then add components: `npx shadcn@latest add button`

### React SSR

Streaming server-side rendering via `registerSSR()`. No `index.html` file — the framework generates the HTML shell with proper `<head>` tags, favicon, manifest, and theme color.

### Auto .env Loading

`.env`, `.env.local`, `.env.development`, `.env.production` — loaded automatically based on `NODE_ENV`. No manual `dotenv.config()` calls.

---

## Agent Tools

When you choose the `agent-app` template, you can select from 6 built-in tools:

| Tool | API Key | Description |
|------|---------|-------------|
| Calculator | None | Math expressions — `(15 * 85) / 100`, `Math.sqrt(144)` |
| Date & Time | None | Current date, time, day of week, timezone support |
| Web Search (Tavily) | `TAVILY_API_KEY` | AI-optimized search — 1,000 free credits/month |
| Web Search (Serper) | `SERPER_API_KEY` | Google search — 2,500 free searches/month |
| Weather | `OPENWEATHER_API_KEY` | Current weather by city — 1,000 free calls/day |
| News | `NEWS_API_KEY` | Headlines & search — free for development |

When RAG is enabled for agent-app, a `rag_search` tool is automatically added that queries your knowledge base via vector similarity.

---

## Features

### Unified AI Provider (`@voltx/ai`)

One API for every LLM. Write your code once, switch providers by changing a string.

```ts
import { streamText, generateText, generateObject, embed } from "@voltx/ai";

// Streaming chat
const stream = await streamText({
  model: "cerebras:llama3.1-8b",
  messages: [{ role: "user", content: "Hello!" }],
});
return stream.toSSEResponse();

// Structured output with Zod schema
const { object } = await generateObject({
  model: "anthropic:claude-sonnet-4-20250514",
  prompt: "Generate a recipe for pasta.",
  schema: z.object({
    name: z.string(),
    ingredients: z.array(z.string()),
    steps: z.array(z.string()),
  }),
});

// Embeddings
const { embedding } = await embed({
  model: "openai:text-embedding-3-small",
  value: "What is TypeScript?",
});
```

**Supported providers:**

| Provider | Chat | Streaming | Tool Calling | Embeddings |
|----------|------|-----------|-------------|------------|
| OpenAI | ✅ | ✅ | ✅ | ✅ |
| Anthropic | ✅ | ✅ | ✅ | — |
| Google Gemini | ✅ | ✅ | ✅ | ✅ |
| Cerebras | ✅ | ✅ | ✅ | — |
| OpenRouter | ✅ | ✅ | ✅ | — |
| Ollama | ✅ | ✅ | ✅ | ✅ |

---

### File-Based Routing (`@voltx/server`)

Drop files in `api/` and they become API endpoints. No manual registration.

```
api/index.ts              → GET /api
api/chat.ts               → POST /api/chat
api/users/[id].ts         → GET /api/users/:id
api/[...slug].ts          → /api/* (catch-all)
```

```ts
import type { Context } from "@voltx/server";

export function GET(c: Context) {
  const id = c.req.param("id");
  return c.json({ id, name: "User" });
}
```

Built on [Hono](https://hono.dev) — CORS, logging, error handling, and static file serving included.

---

### AI Agents (`@voltx/agents`)

Autonomous agents that reason, call tools, and loop until they have an answer.

```ts
import { createAgent } from "@voltx/agents";
import { calculatorTool } from "../tools/calculator";

export const assistant = createAgent({
  name: "assistant",
  model: "cerebras:llama3.1-8b",
  instructions: "You are a helpful AI assistant. Use your tools when needed.",
  tools: [calculatorTool],
  maxIterations: 5,
});
```

```ts
// api/agent.ts
import type { Context } from "@voltx/server";
import { assistant } from "../agents/assistant";

export async function POST(c: Context) {
  const { input } = await c.req.json();
  const result = await assistant.run(input);
  return c.json({ content: result.content, steps: result.steps });
}
```

---

### RAG Pipeline (`@voltx/rag`)

Document ingestion, chunking, embedding, and retrieval — all wired together.

```ts
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const vectorStore = createVectorStore();
const embedder = createEmbedder({ model: "openai:text-embedding-3-small" });
const rag = createRAGPipeline({ embedder, vectorStore });

await rag.ingest("Your document text here...", "doc-prefix");
const context = await rag.getContext("What is VoltX?", { topK: 5 });
```

**Vector store options:** in-memory (dev), Pinecone, pgvector

---

### Conversation Memory (`@voltx/memory`)

```ts
import { createMemory } from "@voltx/memory";

const memory = createMemory({ maxMessages: 50 });
await memory.add("conv-1", { role: "user", content: "Hello!" });
const history = await memory.get("conv-1");
```

---

### Authentication (`@voltx/auth`)

Three auth strategies, one API:

```ts
import { createAuth } from "@voltx/auth";

// Better Auth — full-featured (email/password, OAuth, sessions)
const auth = createAuth("better-auth", { database: process.env.DATABASE_URL! });

// JWT — stateless token-based
const jwt = createAuth("jwt", { secret: process.env.JWT_SECRET! });

// API Key — simple static keys
const apiKey = createAuth("api-key", { keys: { "sk-abc": { id: "1" } } });
```

---

### React Hooks (`@voltx/ui`)

```tsx
import { useChat, useAgent } from "@voltx/ui";

function ChatPage() {
  const { messages, input, setInput, sendMessage, isLoading } = useChat({
    api: "/api/chat",
  });
  // ...
}
```

---

### CLI (`@voltx/cli`)

```bash
voltx dev          # Vite dev server with HMR + backend
voltx build        # 3-phase build: client → SSR → server
voltx start        # Start production server
voltx generate route api/users
voltx generate agent assistant
voltx generate tool search
```

---

### Configuration

```ts
// voltx.config.ts
import { defineConfig } from "@voltx/core";

export default defineConfig({
  name: "my-app",
  port: 3000,
  ai: {
    provider: "cerebras",
    model: "llama3.1-8b",
  },
  server: {
    routesDir: "api",
    staticDir: "public",
    cors: true,
  },
});
```

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@voltx/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@voltx/core?color=blue)](https://npmjs.com/package/@voltx/core) | Framework engine — config, env loading, app lifecycle |
| [`@voltx/ai`](./packages/ai) | [![npm](https://img.shields.io/npm/v/@voltx/ai?color=blue)](https://npmjs.com/package/@voltx/ai) | Unified LLM — 6 providers, streaming, tool calling, embeddings |
| [`@voltx/server`](./packages/server) | [![npm](https://img.shields.io/npm/v/@voltx/server?color=blue)](https://npmjs.com/package/@voltx/server) | Hono HTTP server with file-based routing + React SSR |
| [`@voltx/db`](./packages/db) | [![npm](https://img.shields.io/npm/v/@voltx/db?color=blue)](https://npmjs.com/package/@voltx/db) | Drizzle ORM + Neon Postgres + Pinecone + pgvector |
| [`@voltx/agents`](./packages/agents) | [![npm](https://img.shields.io/npm/v/@voltx/agents?color=blue)](https://npmjs.com/package/@voltx/agents) | ReAct agent loop with tool calling |
| [`@voltx/rag`](./packages/rag) | [![npm](https://img.shields.io/npm/v/@voltx/rag?color=blue)](https://npmjs.com/package/@voltx/rag) | RAG pipeline — chunking, embeddings, vector retrieval |
| [`@voltx/memory`](./packages/memory) | [![npm](https://img.shields.io/npm/v/@voltx/memory?color=blue)](https://npmjs.com/package/@voltx/memory) | Conversation memory — in-memory + Postgres |
| [`@voltx/auth`](./packages/auth) | [![npm](https://img.shields.io/npm/v/@voltx/auth?color=blue)](https://npmjs.com/package/@voltx/auth) | Auth — Better Auth + JWT + API keys |
| [`@voltx/ui`](./packages/ui) | [![npm](https://img.shields.io/npm/v/@voltx/ui?color=blue)](https://npmjs.com/package/@voltx/ui) | React hooks — useChat, useAgent |
| [`@voltx/cli`](./packages/cli) | [![npm](https://img.shields.io/npm/v/@voltx/cli?color=blue)](https://npmjs.com/package/@voltx/cli) | CLI — dev server, build, start, code generation |
| [`create-voltx-app`](./packages/create-voltx-app) | [![npm](https://img.shields.io/npm/v/create-voltx-app?color=blue)](https://npmjs.com/package/create-voltx-app) | Interactive project scaffolder |

---

## Deployment

VoltX apps are Node.js servers. They run anywhere Node runs.

```bash
voltx build
voltx start
```

Works on Railway, Render, Fly.io, DigitalOcean, AWS, GCP, or any Docker host.

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

---

## Development (Contributing)

```bash
git clone https://github.com/codewithshail/voltx.git
cd voltx
pnpm install
pnpm build
```

This is a pnpm + Turborepo monorepo with 11 packages. All packages build to CJS + ESM with TypeScript declarations.

---

## Roadmap

- [x] Phase 1 — Core framework, server, config, plugin system
- [x] Phase 2 — AI providers, agents, RAG, memory, auth, DB, CLI, scaffolder, tools, frontend UI
- [x] Phase 3 (Steps 1–4) — .env auto-loading, Vite dev server, full-stack restructure, React SSR, Tailwind CSS v4, shadcn/ui, path aliases, public assets
- [ ] Phase 3 (Steps 5–7) — Streaming UI components, background jobs, deployment helpers

---

## License

[MIT](./LICENSE)

<p align="center">
  Made with ♥ by the <strong>Promptly AI Team</strong><br/>
  <a href="https://github.com/codewithshail/voltx">GitHub</a> · <a href="https://voltx.co.in">Docs</a> · <a href="https://buymeacoffee.com/promptlyai">Buy us a coffee ☕</a>
</p>
