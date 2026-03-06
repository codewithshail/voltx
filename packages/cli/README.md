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

Command-line tools for the [VoltX](https://github.com/codewithshail/voltx) framework. Scaffold projects, run the dev server, build for production, and generate code.

## Installation

```bash
npm install -g @voltx/cli
```

Or use directly with npx:

```bash
npx @voltx/cli dev
```

## Commands

### Development

```bash
voltx dev          # Start dev server with hot reload
voltx build        # Build for production
voltx start        # Start production server
```

### Create a New Project

```bash
voltx create my-app
voltx create my-app --template chatbot
voltx create my-app --template rag-app
voltx create my-app --template agent-app
```

> For the full interactive experience with tool selection, RAG toggle, and API key management, use `npx create-voltx-app` instead.

### Code Generation

```bash
voltx generate route api/users      # New API route
voltx generate agent assistant       # New agent definition
voltx generate tool search           # New tool for agents
voltx generate job cleanup           # New background job
```

## Templates

| Template | What you get | Frontend UI |
|----------|-------------|-------------|
| `blank` | Minimal server with file-based routing | — |
| `chatbot` | Streaming chat + memory | Chat interface |
| `rag-app` | Document Q&A + vector search | Ingest + query split view |
| `agent-app` | AI agent with calculator + datetime tools | Chat with tool steps |

All non-blank templates include a `public/index.html` with a dark-theme Tailwind CSS UI that connects to the backend API routes.

## Programmatic Usage

```ts
import { createProject } from "@voltx/cli";

await createProject({
  name: "my-app",
  template: "chatbot",
  auth: "jwt",
});
```

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
