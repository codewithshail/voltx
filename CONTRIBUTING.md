# Contributing to VoltX

Thank you for your interest in contributing to VoltX! This document will help you get started.

## Development Setup

```bash
git clone https://github.com/codewithshail/voltx.git
cd voltx
pnpm install
pnpm build
```

## Project Structure

This is a pnpm + Turborepo monorepo with 11 packages under `packages/`:

- `@voltx/core` — Framework engine
- `@voltx/ai` — Unified LLM provider abstraction
- `@voltx/server` — Hono-based HTTP server + Vite plugins + SSR
- `@voltx/agents` — ReAct agent loop with tool calling
- `@voltx/rag` — RAG pipeline (chunking, embeddings, retrieval)
- `@voltx/memory` — Conversation memory (in-memory + Postgres)
- `@voltx/auth` — Authentication (Better Auth, JWT, API keys)
- `@voltx/db` — Drizzle ORM + vector stores (Pinecone, pgvector, in-memory)
- `@voltx/ui` — React hooks (useChat, useAgent)
- `@voltx/cli` — CLI (dev, build, start, generate)
- `create-voltx-app` — Project scaffolder

## Making Changes

1. Create a branch from `main`
2. Make your changes in the relevant package(s)
3. Add or update tests in the package's `test/` directory
4. Run tests: `pnpm test`
5. Build all packages: `pnpm build`
6. Submit a PR with a clear description

## Conventional Commits

We use conventional commits to automate changelogs:

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only changes
- `refactor:` — Code change that neither fixes a bug nor adds a feature
- `test:` — Adding or correcting tests
- `chore:` — Build process or auxiliary tool changes

## Testing

All new features should include tests. We use **Vitest**.

```bash
# Run all tests
pnpm test

# Run tests for a specific package
cd packages/ai && pnpm test
```

## Code Style

- TypeScript with strict mode enabled
- Use `.js` extensions in imports (required for ESM compatibility)
- All public APIs must be typed
- Prefer explicit types over `any`

## Questions?

Open a [Discussion](https://github.com/codewithshail/voltx/discussions) or ask in an issue.
