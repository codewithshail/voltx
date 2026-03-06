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

Command-line tools for the [VoltX](https://github.com/codewithshail/voltx) framework. Scaffold new projects, run the dev server, and build for production.

## Installation

```bash
npm install -g @voltx/cli
```

Or use directly with npx:

```bash
npx @voltx/cli create my-app
```

## Commands

### Create a New Project

```bash
voltx create my-app
voltx create my-app --template chatbot
voltx create my-app --template rag-app
voltx create my-app --template agent-app
```

### Available Templates

| Template | Description |
|----------|-------------|
| `blank` | Minimal server with file-based routing |
| `chatbot` | Streaming chat with AI + conversation memory |
| `rag-app` | Document Q&A with embeddings + vector search |
| `agent-app` | Autonomous agent with tools + memory |

## Programmatic Usage

```ts
import { createProject } from "@voltx/cli";

await createProject({
  name: "my-app",
  template: "chatbot",
});
```

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
