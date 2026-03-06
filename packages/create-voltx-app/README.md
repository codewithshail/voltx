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

The fastest way to start a new [VoltX](https://github.com/codewithshail/voltx) project. Full interactive CLI with template selection, AI provider picker, agent tool selection, RAG toggle, API key management, and a built-in frontend UI.

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
   └─ Labels show embedding support hints
4. Agent tools (agent-app only, multi-select)
   └─ Calculator, Date/Time, Web Search (Tavily), Web Search (Serper),
      Weather (OpenWeatherMap), News (NewsAPI)
5. Enable RAG? (chatbot/agent-app toggle)
6. Embedding provider (if RAG + main provider has no embeddings)
7. Auth → Better Auth | JWT | None
8. Package manager → npm | pnpm | yarn | bun
9. API keys → enter now (masked input) or skip (.env with placeholders)
10. Install dependencies
11. Initialize git
```

## Templates

| Template | Backend | Frontend UI |
|----------|---------|-------------|
| `blank` | Minimal Hono server with file-based routing | — |
| `chatbot` | Streaming chat with `@voltx/ai` + `@voltx/memory`, optional RAG | Chat interface with streaming bubbles |
| `rag-app` | Document Q&A with `@voltx/rag` + vector search | Split view: ingest panel + query chat |
| `agent-app` | AI agent with selectable tools + `@voltx/agents`, optional RAG | Chat with tool step visualization |

## Agent Tools

| Tool | API Key | Free Tier |
|------|---------|-----------|
| Calculator | None | — |
| Date & Time | None | — |
| Web Search (Tavily) | `TAVILY_API_KEY` | 1,000 credits/month |
| Web Search (Serper) | `SERPER_API_KEY` | 2,500 searches/month |
| Weather (OpenWeatherMap) | `OPENWEATHER_API_KEY` | 1,000 calls/day |
| News (NewsAPI) | `NEWS_API_KEY` | 100 requests/day (dev) |

## What Gets Scaffolded

```
my-app/
├── src/
│   ├── routes/
│   │   ├── api/
│   │   │   ├── chat.ts           # Streaming chat (chatbot/agent-app)
│   │   │   ├── agent.ts          # Agent endpoint (agent-app)
│   │   │   └── rag/
│   │   │       ├── query.ts      # RAG query (rag-app or RAG enabled)
│   │   │       └── ingest.ts     # Document ingest
│   │   └── index.ts              # Health check
│   ├── agents/
│   │   └── assistant.ts          # Agent with selected tools (agent-app)
│   ├── tools/
│   │   ├── calculator.ts         # Math expressions
│   │   ├── datetime.ts           # Current date/time
│   │   ├── web-search-tavily.ts  # Tavily search
│   │   ├── web-search-serper.ts  # Serper Google search
│   │   ├── weather.ts            # OpenWeatherMap
│   │   ├── news.ts               # NewsAPI
│   │   └── rag-search.ts         # RAG vector search (if RAG enabled)
│   └── index.ts                  # App entry point
├── public/
│   └── index.html                # Frontend UI (Tailwind CSS, dark theme)
├── voltx.config.ts
├── .env                          # Real keys (gitignored)
├── .env.example                  # Placeholder template
├── .gitignore
├── tsconfig.json
├── package.json
└── README.md
```

## Frontend UI

Every non-blank template includes a `public/index.html` with a polished dark-theme UI:

- **Chatbot** — Blue accent, streaming message bubbles, typing indicator
- **RAG App** — Emerald accent, split layout with document ingest + query chat
- **Agent App** — Purple accent, chat with spinner + tool step display

Built with Tailwind CSS CDN (v3.4.17). No build step — open `localhost:3000` and it works. Will be replaced with Vite + React in Phase 3.

## Part of VoltX

This is the project scaffolder for the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
