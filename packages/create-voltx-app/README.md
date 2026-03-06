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

The fastest way to start a new [VoltX](https://github.com/codewithshail/voltx) project. Interactive CLI with template selection, package manager detection, and git initialization.

## Usage

```bash
npx create-voltx-app my-app
```

Or with a specific template:

```bash
npx create-voltx-app my-app --template chatbot
npx create-voltx-app my-app --template rag-app
npx create-voltx-app my-app --template agent-app
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

## Templates

| Template | What you get |
|----------|-------------|
| `blank` | Minimal Hono server with file-based routing |
| `chatbot` | Streaming chat with `@voltx/ai` + `@voltx/memory` |
| `rag-app` | Document Q&A with `@voltx/rag` + vector search |
| `agent-app` | AI agent with tools via `@voltx/agents` |

## What Gets Scaffolded

```
my-app/
├── src/
│   ├── routes/
│   │   ├── api/
│   │   │   └── chat.ts       # Template-specific API route
│   │   └── index.ts           # Health check endpoint
│   └── index.ts               # App entry point
├── public/                     # Static files
├── voltx.config.ts             # VoltX configuration
├── .env.example                # Environment variables template
├── .gitignore
├── tsconfig.json
├── package.json
└── README.md
```

## Part of VoltX

This is the project scaffolder for the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
