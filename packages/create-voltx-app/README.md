<p align="center">
  <strong>create-voltx-app</strong><br/>
  <em>Create a new VoltX AI-powered app with one command</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/create-voltx-app"><img src="https://img.shields.io/npm/v/create-voltx-app?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/create-voltx-app"><img src="https://img.shields.io/npm/dm/create-voltx-app" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/create-voltx-app" alt="license" /></a>
</p>

---

The fastest way to start a new [VoltX](https://github.com/codewithshail/voltx) project. Full interactive CLI with template selection, AI provider picker, agent tool selection, RAG toggle, shadcn/ui setup, API key management, and a built-in React frontend with SSR and file-based routing.

## Usage

```bash
npx create-voltx-app my-app
```

### Non-Interactive Mode

```bash
npx create-voltx-app my-app --template chatbot --yes
```

### Package Manager

```bash
npx create-voltx-app my-app --use-pnpm
npx create-voltx-app my-app --use-yarn
npx create-voltx-app my-app --use-bun
```

## Interactive Flow

```
 1. Project name
 2. Template → chatbot | rag-app | agent-app | blank
 3. AI provider → Cerebras, OpenAI, Anthropic, Google, OpenRouter, Ollama
 4. Agent tools (agent-app only, multi-select)
 5. Enable RAG? (chatbot/agent-app toggle)
 6. Embedding provider (if RAG + main provider has no embeddings)
 7. Auth → Better Auth | JWT | None
 8. Include shadcn/ui? (pre-configured component library)
 9. Package manager → npm | pnpm | yarn | bun
10. API keys → enter now (masked input) or skip
11. Install dependencies
12. Initialize git
```

## Templates

| Template | Backend | Frontend |
|----------|---------|----------|
| `blank` | Hono server with file-based routing | Cinematic hero page with video background |
| `chatbot` | Streaming chat + memory, optional RAG | Chat interface with streaming bubbles |
| `rag-app` | Document Q&A + vector search | Split view: ingest panel + query chat |
| `agent-app` | AI agent with selectable tools, optional RAG | Chat with tool step visualization |

All templates are full-stack: React frontend with SSR + Hono backend.

## What Gets Scaffolded

```
my-app/
├── api/                    # API routes (auto-discovered via voltx/api)
│   └── index.ts            # GET /api — health check
├── src/
│   ├── pages/              # Pages (auto-discovered via voltx/router)
│   │   └── index.tsx       # / — home page
│   ├── layout.tsx          # Root layout wrapper
│   ├── globals.css         # Tailwind CSS v4 + theme
│   ├── entry-client.tsx    # Client hydration
│   ├── entry-server.tsx    # SSR rendering
│   ├── voltx-env.d.ts     # Type declarations
│   ├── components/
│   ├── hooks/
│   └── lib/
├── server.ts               # Hono app entry
├── vite.config.ts          # Vite + voltxRouter() + voltxAPI()
├── voltx.config.ts         # VoltX config
└── tsconfig.json
```

## Built-in Features

- File-based page routing via `voltx/router`
- File-based API routing via `voltx/api`
- Navigation: `Link`, `NavLink`, `useNavigate`, `useParams` from `voltx/router`
- Tailwind CSS v4 with `@tailwindcss/vite`
- Path aliases: `@/*` → `src/*`
- shadcn/ui (optional)
- React SSR (streaming)
- Auto .env loading

## Part of VoltX

See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
