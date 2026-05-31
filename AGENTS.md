# AGENTS.md — Agent Development Guide for VoltX

This file helps AI coding agents (Codex, Claude Code, OpenCode, etc.) understand the VoltX monorepo and contribute effectively.

## Project Overview

**VoltX** is an AI-first full-stack TypeScript framework. It eliminates the need to wire together 10+ libraries when building AI applications. One `npx create-voltx-app` scaffolds a complete full-stack app with React SSR, file-based routing, unified LLM providers, agents, RAG, auth, and DB.

- **Language**: TypeScript (strict mode, ESM)
- **Monorepo**: pnpm workspaces + Turborepo
- **Build Tool**: tsup (CJS + ESM dual build)
- **Framework**: Vite (frontend), Hono (backend)
- **React**: v19 with SSR support
- **Test Runner**: Vitest

## Repository Layout

```
/
├── packages/
│   ├── core/           — Framework engine, config, plugin system, logger, env loader
│   ├── ai/             — Unified LLM abstraction: generateText, streamText, generateObject, embed
│   ├── server/         — Hono HTTP server, file-based routing, SSR, Vite plugins
│   ├── agents/         — ReAct agent loop with tool calling and memory
│   ├── rag/            — Document chunking, embedding, vector retrieval
│   ├── memory/         — Conversation memory: in-memory + Postgres
│   ├── auth/           — Authentication: Better Auth, JWT, API keys
│   ├── db/             — Drizzle ORM, vector stores (in-memory, Pinecone, pgvector)
│   ├── ui/             — React hooks (useChat, useAgent)
│   ├── cli/            — CLI commands (dev, build, start, generate)
│   └── create-voltx-app/ — Interactive project scaffolder
├── templates/          — Starter templates (chatbot, rag-app, agent-app, blank)
├── examples/           — Example applications demonstrating framework usage
├── package.json        — Root monorepo config
├── pnpm-workspace.yaml — pnpm workspace definition
├── turbo.json          — Turborepo pipeline (build, test, lint, dev)
└── tsconfig.base.json  — Shared TypeScript config
```

## Build System

### Package Build

Each package uses **tsup** to build to both CJS and ESM:

```bash
# Build all packages
pnpm build

# Build a single package
cd packages/ai && pnpm build
```

### Key Build Details

- tsup generates `.js` (ESM) + `.cjs` (CJS) + `.d.ts` (types)
- Internal deps use `workspace:^` protocol
- All source files use `.js` extensions in imports, even for `.ts` files (Node16 ESM requirement)

### Turbo Pipeline

```json
{
  "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
  "test": { "dependsOn": ["build"] },
  "lint": { "dependsOn": ["^build"] }
}
```

## TypeScript Configuration

- **Target**: ES2022
- **Module**: ESNext
- **Module Resolution**: bundler
- **Strict**: true
- **SkipLibCheck**: true
- **Declaration**: true (emits `.d.ts` files)

## Package Dependency Graph

```
core → server
ai   → (none — pure provider abstraction)
server → hono, @hono/node-server, vite, react, react-dom
agents → ai, memory
memory → (none)
rag → db
auth → (none)
db → drizzle-orm
ui → react
cli → (none — spawns processes)
create-voltx-app → (none)
```

## Conventions

### Imports

Always use `.js` extension for relative imports, even in `.ts` files:

```ts
// Correct
import { generateText } from "./generate-text.js";

// Incorrect
import { generateText } from "./generate-text";
```

### File Naming

- Source files: `kebab-case.ts`
- Test files: `kebab-case.test.ts` (placed in package `test/` directory)
- React components: `PascalCase.tsx`

### Error Messages

Prefix all errors with `[voltx/{package}]` for clear attribution:

```ts
throw new Error(`[voltx/ai] Provider "${name}" does not support embeddings.`);
```

### API Design

- Factory functions for creating instances: `createAgent()`, `createMemory()`, `createServer()`
- Class-based for stateful objects: `Agent`, `VoltxApp`, `RAGPipeline`
- Config-first: all constructors/factories accept a single options object
- Environment variables auto-resolved (e.g., `OPENAI_API_KEY` read automatically)

## Testing

We use **Vitest** for testing.

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch
```

### Writing Tests

- Place tests in `packages/{name}/test/`
- Use `describe`, `it`, and `expect` from vitest
- Mock external APIs (LLM providers, DBs) — never hit real services in tests
- Test public API surfaces: factories, classes, utility functions

### Mocking LLM Providers

The `@voltx/ai` provider registry allows registering mock providers at runtime:

```ts
import { registerProvider } from "@voltx/ai";
import type { AIProvider } from "@voltx/ai";

registerProvider("mock", () => ({
  name: "mock",
  chat: async () => ({ text: "Hello", toolCalls: [], usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, finishReason: "stop", raw: {} }),
  stream: async () => ({ stream: (async function* () {})() }),
}));
```

## Important Notes for AI Agents

1. **Always read the package source before modifying it** — check `packages/{name}/src/index.ts` for exports
2. **Use `.js` extensions in all imports** — This is required for ESM compatibility
3. **Update tests when changing behavior** — Tests are in `packages/{name}/test/`
4. **Build after changes** — Run `pnpm build` before testing integration
5. **Check dependency graph** — Changes in `ai` affect `agents`, `rag`, and `ui`
6. **Don't hit real APIs in tests** — Always mock LLM providers and DB connections
7. **Preserve backward compatibility** — Deprecated features get a warning, not a removal
8. **Keep the README updated** — If you change public APIs, update the root README example
