<p align="center">
  <img src="https://img.shields.io/badge/⚡-VoltX-blueviolet?style=for-the-badge&labelColor=000" alt="VoltX" />
</p>

<p align="center">
  <strong>The AI-first full-stack TypeScript framework</strong><br/>
  <em>Server + AI + Agents + RAG + DB + Auth + Memory + UI — all wired together</em>
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

VoltX is a full-stack TypeScript framework purpose-built for AI applications. Instead of wiring together 10 different packages, you get one framework where everything works out of the box — LLM providers, streaming, agents, RAG pipelines, database, auth, conversation memory, and React hooks.

One config. One command. Everything runs.

```bash
npx create-voltx-app my-app
```

```ts
// src/routes/api/chat.ts — that's it, streaming chat endpoint
import { streamText } from "@voltx/ai";

export async function POST(c) {
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
# Interactive setup
npx create-voltx-app my-app

# Non-interactive with defaults
npx create-voltx-app my-app --template chatbot --yes
```

### Interactive Flow

The scaffolder walks you through a complete setup:

```
1. Project name
2. Template (chatbot, RAG app, agent app, or blank)
3. AI provider (Cerebras, OpenAI, Anthropic, Google, OpenRouter, Ollama)
   └─ RAG-app restricts to embedding-capable providers (OpenAI, Google, Ollama)
   └─ Provider labels show embedding support hints
4. Agent tools (agent-app only — multi-select)
   └─ Calculator, Date/Time, Web Search (Tavily), Web Search (Serper),
      Weather (OpenWeatherMap), News (NewsAPI)
5. Enable RAG? (chatbot/agent-app toggle — adds knowledge base)
6. Embedding provider (if RAG enabled + main provider has no embeddings)
7. Auth strategy (Better Auth, JWT, or none)
8. Package manager (npm, pnpm, yarn, bun)
9. API keys — enter now or skip (creates .env with placeholders)
10. Install dependencies
11. Initialize git
```

```bash
cd my-app
pnpm dev
# ⚡ VoltX server running at http://localhost:3000
# Open http://localhost:3000 — interactive UI included
```

### Templates

| Template | What you get | Frontend UI |
|----------|-------------|-------------|
| `chatbot` | Streaming chat + memory, optional RAG | Chat interface with streaming bubbles |
| `rag-app` | Document Q&A with embeddings + vector search | Split view: ingest panel + query chat |
| `agent-app` | AI agent with tools + memory, optional RAG | Chat with tool step visualization |
| `blank` | Minimal server with file-based routing | — |

Every non-blank template includes a polished `public/index.html` with a dark-theme Tailwind CSS UI that connects to the backend API routes out of the box. Open `localhost:3000` and start using it immediately.

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

Tools are generated as individual files in `src/tools/` with proper types, error handling, and API integration. The agent definition in `src/agents/assistant.ts` automatically imports and wires up your selected tools.

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

Drop files in `src/routes/` and they become API endpoints. No manual registration.

```
src/routes/index.ts              → GET /
src/routes/api/chat.ts           → POST /api/chat
src/routes/api/users/[id].ts     → GET /api/users/:id
src/routes/api/[...slug].ts      → /api/* (catch-all)
```

```ts
// src/routes/api/users/[id].ts
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
import { tavilySearchTool } from "../tools/web-search-tavily";

export const assistant = createAgent({
  name: "assistant",
  model: "cerebras:llama3.1-8b",
  instructions: "You are a helpful AI assistant. Use your tools when needed.",
  tools: [calculatorTool, tavilySearchTool],
  maxIterations: 5,
});
```

```ts
// src/routes/api/agent.ts
import { assistant } from "../../agents/assistant";

export async function POST(c) {
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

// Ingest documents
await rag.ingest("Your document text here...", "doc-prefix");

// Query with context
const context = await rag.getContext("What is VoltX?", { topK: 5 });
```

RAG can be enabled for chatbot and agent-app templates too — the scaffolder adds a toggle. When enabled on chatbot, the chat route pulls context from the vector store before responding. When enabled on agent-app, a `rag_search` tool is added to the agent.

**Vector store options:**
- `createVectorStore()` — in-memory (development)
- `createVectorStore("pinecone", { apiKey, index })` — Pinecone (production)
- `createVectorStore("pgvector", { connectionString })` — pgvector (production)

---

### Conversation Memory (`@voltx/memory`)

Persistent conversation history with automatic context management.

```ts
import { createMemory } from "@voltx/memory";

const memory = createMemory({ maxMessages: 50 });

await memory.add("conv-1", { role: "user", content: "Hello!" });
const history = await memory.get("conv-1");
```

---

### Database (`@voltx/db`)

Drizzle ORM with Neon Postgres, plus vector store adapters.

```ts
import { createDB } from "@voltx/db";

const db = createDB({ url: process.env.DATABASE_URL });
```

---

### Authentication (`@voltx/auth`)

Three auth strategies, one API. Native Hono middleware.

```ts
import { createAuth, createAuthMiddleware } from "@voltx/auth";

// Better Auth — full-featured (email/password, OAuth, sessions)
const auth = createAuth("better-auth", {
  database: process.env.DATABASE_URL!,
  emailAndPassword: true,
});

// JWT — stateless token-based
const jwt = createAuth("jwt", {
  secret: process.env.JWT_SECRET!,
  expiresIn: "7d",
});

// API Key — simple static keys
const apiKey = createAuth("api-key", {
  keys: { "sk-live-abc123": { id: "1", email: "admin@example.com" } },
});
```

---

### React Hooks (`@voltx/ui`)

Frontend hooks for chat and agent interactions.

```ts
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

Dev server with hot reload, production build, code generation.

```bash
voltx dev          # Development server with hot reload
voltx build        # Build for production
voltx start        # Start production server
voltx generate route api/users
voltx generate agent assistant
voltx generate tool search
```

---

### Frontend UI

Every non-blank template ships with a `public/index.html` — a polished, responsive dark-theme UI built with Tailwind CSS (CDN). It connects to the backend API routes and works immediately.

- **Chatbot** — Chat interface with streaming message bubbles, typing indicator
- **RAG App** — Split layout: document ingest panel (left) + query chat (right)
- **Agent App** — Chat with spinner while agent thinks, tool step visualization

No build step needed. Open `localhost:3000` after `voltx dev` and it just works. This static UI will be replaced with a proper Vite + React setup in Phase 3.

---

### Configuration

Everything is configured in one file:

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
  db: {
    url: process.env.DATABASE_URL,
  },
  auth: {
    provider: "better-auth",
  },
  server: {
    routesDir: "src/routes",
    staticDir: "public",
    cors: true,
  },
});
```

---

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [`@voltx/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@voltx/core?color=blue)](https://npmjs.com/package/@voltx/core) | Framework engine — config, plugins, app lifecycle |
| [`@voltx/ai`](./packages/ai) | [![npm](https://img.shields.io/npm/v/@voltx/ai?color=blue)](https://npmjs.com/package/@voltx/ai) | Unified LLM — 6 providers, streaming, tool calling, embeddings |
| [`@voltx/server`](./packages/server) | [![npm](https://img.shields.io/npm/v/@voltx/server?color=blue)](https://npmjs.com/package/@voltx/server) | Hono HTTP server with file-based routing |
| [`@voltx/db`](./packages/db) | [![npm](https://img.shields.io/npm/v/@voltx/db?color=blue)](https://npmjs.com/package/@voltx/db) | Drizzle ORM + Neon Postgres + Pinecone + pgvector |
| [`@voltx/agents`](./packages/agents) | [![npm](https://img.shields.io/npm/v/@voltx/agents?color=blue)](https://npmjs.com/package/@voltx/agents) | ReAct agent loop with tool calling |
| [`@voltx/rag`](./packages/rag) | [![npm](https://img.shields.io/npm/v/@voltx/rag?color=blue)](https://npmjs.com/package/@voltx/rag) | RAG pipeline — chunking, embeddings, vector retrieval |
| [`@voltx/memory`](./packages/memory) | [![npm](https://img.shields.io/npm/v/@voltx/memory?color=blue)](https://npmjs.com/package/@voltx/memory) | Conversation memory — in-memory + Postgres |
| [`@voltx/auth`](./packages/auth) | [![npm](https://img.shields.io/npm/v/@voltx/auth?color=blue)](https://npmjs.com/package/@voltx/auth) | Auth — Better Auth + JWT + API keys |
| [`@voltx/ui`](./packages/ui) | [![npm](https://img.shields.io/npm/v/@voltx/ui?color=blue)](https://npmjs.com/package/@voltx/ui) | React hooks — useChat, useAgent |
| [`@voltx/cli`](./packages/cli) | [![npm](https://img.shields.io/npm/v/@voltx/cli?color=blue)](https://npmjs.com/package/@voltx/cli) | CLI — dev server, build, start, code generation |
| [`create-voltx-app`](./packages/create-voltx-app) | [![npm](https://img.shields.io/npm/v/create-voltx-app?color=blue)](https://npmjs.com/package/create-voltx-app) | Interactive project scaffolder |

---

## Project Structure (Agent App Example)

```
my-voltx-app/
├── src/
│   ├── routes/
│   │   ├── api/
│   │   │   ├── chat.ts          # POST /api/chat — streaming AI
│   │   │   ├── agent.ts         # POST /api/agent — agent endpoint
│   │   │   └── rag/
│   │   │       ├── query.ts     # POST /api/rag/query (if RAG enabled)
│   │   │       └── ingest.ts    # POST /api/rag/ingest (if RAG enabled)
│   │   └── index.ts             # GET / — health check
│   ├── agents/
│   │   └── assistant.ts         # Agent definition with tools
│   ├── tools/
│   │   ├── calculator.ts        # Math expressions
│   │   ├── datetime.ts          # Current date/time
│   │   ├── web-search-tavily.ts # Tavily web search
│   │   ├── web-search-serper.ts # Serper Google search
│   │   ├── weather.ts           # OpenWeatherMap
│   │   ├── news.ts              # NewsAPI
│   │   └── rag-search.ts        # RAG vector search (if RAG enabled)
│   └── index.ts                 # App entry point
├── public/
│   └── index.html               # Frontend UI (Tailwind CSS)
├── voltx.config.ts              # Single config file
├── .env                         # Secrets (gitignored)
├── .env.example                 # Template for env vars
├── tsconfig.json
└── package.json
```

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
- [ ] Phase 3 — Vite dev server, React SSR, streaming UI components, background jobs

---

## License

[MIT](./LICENSE)

<p align="center">
  Made with ♥ by the <strong>Promptly AI Team</strong><br/>
  <a href="https://github.com/codewithshail/voltx">GitHub</a> · <a href="https://voltx.co.in">Docs</a> · <a href="https://buymeacoffee.com/promptlyai">Buy us a coffee ☕</a>
</p>
