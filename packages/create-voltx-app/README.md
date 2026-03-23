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
    └─ rag-app restricts to embedding-capable providers
 4. Agent tools (agent-app only, multi-select)
    └─ Calculator, Date/Time, Web Search (Tavily/Serper),
       Weather (OpenWeatherMap), News (NewsAPI)
 5. Enable RAG? (chatbot/agent-app toggle)
 6. Embedding provider (if RAG + main provider has no embeddings)
 7. Auth → Better Auth | JWT | None
 8. Include shadcn/ui? (pre-configured component library)
 9. Package manager → npm | pnpm | yarn | bun
10. API keys → enter now (masked input) or skip (.env with placeholders)
11. Install dependencies
12. Initialize git
```

## Templates

| Template | Backend | Frontend |
|----------|---------|----------|
| `blank` | Hono server with file-based routing | Cinematic hero page with video background |
| `chatbot` | Streaming chat with `@voltx/ai` + `@voltx/memory`, optional RAG | Chat interface with streaming bubbles |
| `rag-app` | Document Q&A with `@voltx/rag` + vector search | Split view: ingest panel + query chat |
| `agent-app` | AI agent with selectable tools + `@voltx/agents`, optional RAG | Chat with tool step visualization |

All templates are full-stack: React frontend with SSR + Hono backend, one `npm run dev` starts everything.

## What Gets Scaffolded

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
│   ├── globals.css         # Tailwind CSS v4 + theme variables
│   ├── entry-client.tsx    # Client hydration (uses voltx/router)
│   ├── entry-server.tsx    # SSR rendering (uses voltx/router)
│   ├── voltx-env.d.ts     # Type declarations for voltx/router & voltx/api
│   ├── components/         # React components
│   ├── hooks/              # Custom hooks
│   └── lib/
│       └── utils.ts        # cn() helper (if shadcn enabled)
├── agents/                 # AI agents (agent-app)
├── tools/                  # Agent tools (agent-app)
├── public/
│   ├── favicon.svg         # VoltX lightning bolt favicon
│   ├── robots.txt          # Search engine config
│   └── site.webmanifest    # PWA manifest
├── server.ts               # Hono app entry (uses voltx/api for auto-discovery)
├── vite.config.ts          # Vite + TailwxRouter() + voltxAPI()
├── components.json         # shadcn/ui config (if enabled)
├── voltx.config.ts         # VoltX config
├── .env                    # Secrets (gitignored)
├── .env.example            # Placeholder template
├── tsconfig.json           # TypeScript (with @/* path alias)
└── package.json
```

## Built-in Features

- **File-based page routing** — `src/pages/*.tsx` auto-discovered, `import { Link } from "voltx/router"`
- **File-based API routing** — `api/**/*.ts` auto-discovered, no manual imports in server.ts
- **Navigation** — `Link`, `NavLink`, `useNavigate`, `useParams`, `useLocation`, `useSearchParams` from `voltx/router`
- **Tailwind CSS v4** — native `@tailwindcss/vite` plugin, `@theme` block with design tokens
- **Path aliases** — `@/*` → `src/*` in TypeScript and Vite
- **shadcn/ui** (optional) — `components.json`, `cn()` utility, HSL CSS variables, ready for `npx shadcn@latest add button`
- **React SSR** — streaming server-side rendering, no `index.html` file needed
- **Auto .env loading** — `.env`, `.env.local`, `.env.development` loaded automatically
- **Public assets** — favicon.svg, robots.txt, site.webmanifest

## Agent Tools

| Tool | API Key | Free Tier |
|------|---------|-----------|
| Calculator | None | — |
| Date & Time | None | — |
| Web Search (Tavily) | `TAVILY_API_KEY` | 1,000 credits/month |
| Web Search (Serper) | `SERPER_API_KEY` | 2,500 searches/month |
| Weather (OpenWeatherMap) | `OPENWEATHER_API_KEY` | 1,000 calls/day |
| News (NewsAPI) | `NEWS_API_KEY` | 100 requests/day (dev) |

## Part of VoltX

ithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
This is the project scaffolder for the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codew