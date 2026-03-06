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

Building AI apps today means stitching together a dozen libraries — an LLM SDK, a web framework, a database ORM, an auth library, a vector store, a streaming solution. VoltX replaces all of that with a single integrated framework.

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
# Interactive setup — choose template, provider, auth
npx create-voltx-app my-app

# Or specify options directly
npx create-voltx-app my-app --template chatbot
```

The scaffolder walks you through:
1. Project name
2. Template (chatbot, RAG app, agent app, or blank)
3. AI provider (Cerebras, OpenAI, Anthropic, Google, OpenRouter, Ollama)
4. API key (masked input)
5. Auth strategy (Better Auth, JWT, or none)
6. Package manager
7. Auto-installs dependencies and initializes git

```bash
cd my-app
pnpm dev
# ⚡ VoltX server running at http://localhost:3000
```

### Templates

| Template | What you get |
|----------|-------------|
| `chatbot` | Streaming chat with AI + conversation memory |
| `rag-app` | Document Q&A with embeddings + vector search |
| `agent-app` | Autonomous AI agent with tools + memory |
| `blank` | Minimal server with file-based routing |

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

// Single completion
const { text } = await generateText({
  model: "openai:gpt-4o",
  prompt: "Explain TypeScript in one sentence.",
});

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

export async function PUT(c: Context) {
  const id = c.req.param("id");
  const body = await c.req.json();
  return c.json({ id, ...body });
}
```

Built on [Hono](https://hono.dev) — CORS, logging, error handling, and static file serving included.

---

### AI Agents (`@voltx/agents`)

Autonomous agents that reason, call tools, and loop until they have an answer. ReAct pattern with built-in tool execution.

```ts
// src/agents/assistant.ts
import { createAgent } from "@voltx/agents";
import { searchTool } from "../tools/search";

export const assistant = createAgent({
  name: "assistant",
  model: "cerebras:llama3.1-8b",
  instructions: "You are a helpful AI assistant. Use your tools when needed.",
  tools: [searchTool],
  maxIterations: 5,
});
```

```ts
// src/tools/search.ts
import type { Tool } from "@voltx/agents";

export const searchTool: Tool = {
  name: "search",
  description: "Search for information on a topic.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query" },
    },
    required: ["query"],
  },
  async execute(args: { query: string }) {
    // Connect your search API here
    return `Results for "${args.query}": ...`;
  },
};
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

**Agent loop:** User message → LLM (with tools) → Tool calls → Execute → Feed results back → Repeat until done or max iterations.

---

### RAG Pipeline (`@voltx/rag`)

Document ingestion, chunking, embedding, and retrieval — all wired together.

```ts
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const vectorStore = createVectorStore();  // in-memory for dev
const embedder = createEmbedder({ model: "openai:text-embedding-3-small" });
const rag = createRAGPipeline({ embedder, vectorStore });

// Ingest documents
await rag.ingest("Your document text here...", "doc-prefix");

// Query with context
const context = await rag.getContext("What is VoltX?", { topK: 5 });
```

**Vector store options:**
- `createVectorStore()` — in-memory (development)
- `createVectorStore("pinecone", { apiKey, index })` — Pinecone (production)
- `createVectorStore("pgvector", { connectionString })` — pgvector (production)

---

### Conversation Memory (`@voltx/memory`)

Persistent conversation history with automatic context management.

```ts
import { createMemory } from "@voltx/memory";

// In-memory (development)
const memory = createMemory({ maxMessages: 50 });

// Postgres-backed (production)
// const memory = createMemory("postgres", { url: process.env.DATABASE_URL });

await memory.add("conv-1", { role: "user", content: "Hello!" });
await memory.add("conv-1", { role: "assistant", content: "Hi there!" });

const history = await memory.get("conv-1");
// → [{ role: "user", content: "Hello!" }, { role: "assistant", content: "Hi there!" }]
```

---

### Database (`@voltx/db`)

Drizzle ORM with Neon Postgres, plus vector store adapters.

```ts
import { createDB } from "@voltx/db";

const db = createDB({ url: process.env.DATABASE_URL });
```

Supports Drizzle schema definitions, migrations, and three vector store backends (in-memory, Pinecone, pgvector).

---

### Authentication (`@voltx/auth`)

Three auth strategies, one API. Native Hono middleware.

```ts
import { createAuth, createAuthMiddleware, createAuthHandler } from "@voltx/auth";

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

```ts
// Protect routes with middleware
app.use("/api/*", createAuthMiddleware({
  provider: auth,
  publicPaths: ["/api/auth", "/api/health"],
}));
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

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>{m.role}: {m.content}</div>
      ))}
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={sendMessage} disabled={isLoading}>Send</button>
    </div>
  );
}
```

---

### CLI (`@voltx/cli`)

Dev server with hot reload, production build, code generation.

```bash
# Development server with hot reload
voltx dev

# Build for production
voltx build

# Start production server
voltx start

# Generate code
voltx generate route api/users
voltx generate agent assistant
voltx generate tool search
voltx generate job cleanup
```

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

## Project Structure

```
my-voltx-app/
├── src/
│   ├── routes/              # File-based API routing
│   │   ├── api/
│   │   │   ├── chat.ts      # POST /api/chat — streaming AI
│   │   │   ├── agent.ts     # POST /api/agent — agent endpoint
│   │   │   └── rag/
│   │   │       ├── query.ts  # POST /api/rag/query
│   │   │       └── ingest.ts # POST /api/rag/ingest
│   │   └── index.ts         # GET / — health check
│   ├── agents/              # AI agent definitions
│   │   └── assistant.ts
│   ├── tools/               # Custom tools for agents
│   │   └── search.ts
│   └── index.ts             # App entry point
├── public/                  # Static assets
├── voltx.config.ts          # Single config file
├── .env                     # Secrets (gitignored)
├── .env.example             # Template for env vars
├── tsconfig.json
└── package.json
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| HTTP Server | [Hono](https://hono.dev) |
| Routing | File-based (Next.js-style) |
| LLM Providers | OpenAI, Anthropic, Google, Cerebras, OpenRouter, Ollama |
| Streaming | Server-Sent Events (SSE) |
| Database | [Neon](https://neon.tech) Postgres + [Drizzle](https://orm.drizzle.team) ORM |
| Vector DB | [Pinecone](https://pinecone.io), pgvector, in-memory |
| Auth | [Better Auth](https://www.better-auth.com), JWT, API keys |
| Frontend | React hooks |
| Build | [tsup](https://tsup.egoist.dev) (CJS + ESM) |
| Monorepo | [pnpm](https://pnpm.io) + [Turborepo](https://turbo.build) |

---

## Environment Variables

```env
# AI Provider (pick one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...
CEREBRAS_API_KEY=csk-...
OPENROUTER_API_KEY=sk-or-...

# Database
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Vector DB (optional)
PINECONE_API_KEY=pc-...
PINECONE_INDEX=voltx-embeddings

# Auth (optional)
JWT_SECRET=your-secret
BETTER_AUTH_SECRET=your-secret-min-32-chars

# App
PORT=3000
NODE_ENV=development
```

---

## Deployment

VoltX apps are Node.js servers. They run anywhere Node runs.

```bash
# Build for production
voltx build

# Start production server
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

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @voltx/ai build

# Run all in dev mode
pnpm dev
```

---

## Roadmap

- [x] Phase 1 — Core framework, server, config, plugin system
- [x] Phase 2 — AI providers, agents, RAG, memory, auth, DB, CLI, scaffolder
- [ ] Phase 3 — Vite dev server, React SSR, streaming UI components, background jobs

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

## License

[MIT](./LICENSE)

---

<p align="center">
  Made with ♥ by the <strong>Promptly AI Team</strong><br/>
  <a href="https://github.com/codewithshail/voltx">GitHub</a> · <a href="https://voltx.co.in">Docs</a> · <a href="https://buymeacoffee.com/promptlyai">Buy us a coffee ☕</a>
</p>
