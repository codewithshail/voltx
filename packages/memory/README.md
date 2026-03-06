<p align="center">
  <strong>@voltx/memory</strong><br/>
  <em>Conversation memory for agents and chat — in-memory + Postgres</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/memory"><img src="https://img.shields.io/npm/v/@voltx/memory?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/memory"><img src="https://img.shields.io/npm/dm/@voltx/memory" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/memory" alt="license" /></a>
</p>

---

Conversation memory for the [VoltX](https://github.com/codewithshail/voltx) framework. Store and retrieve chat history for agents and chatbots. Supports in-memory (dev) and Postgres (production) backends.

## Installation

```bash
npm install @voltx/memory
```

## Quick Start

```ts
import { createMemory } from "@voltx/memory";

// In-memory (development)
const memory = createMemory({ maxMessages: 50 });

// Postgres (production)
const memory = createMemory("postgres", {
  url: process.env.DATABASE_URL,
});
```

## Usage

```ts
// Add messages to a conversation
await memory.add("conv-1", { role: "user", content: "Hello!" });
await memory.add("conv-1", { role: "assistant", content: "Hi there!" });

// Retrieve conversation history
const messages = await memory.get("conv-1");
// → [{ role: "user", content: "Hello!" }, { role: "assistant", content: "Hi there!" }]

// List all conversations
const conversations = await memory.list();

// Clear a conversation
await memory.clear("conv-1");
```

## With a Chatbot

```ts
import { streamText } from "@voltx/ai";
import { createMemory } from "@voltx/memory";

const memory = createMemory({ maxMessages: 50 });

export async function POST(c) {
  const { messages, conversationId } = await c.req.json();

  // Store user message
  await memory.add(conversationId, messages[messages.length - 1]);

  // Get full history
  const history = await memory.get(conversationId);

  const result = await streamText({
    model: "cerebras:llama3.1-8b",
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  // Store assistant response
  result.text.then((text) => {
    memory.add(conversationId, { role: "assistant", content: text });
  });

  return result.toSSEResponse();
}
```

## Backends

| Backend | Use Case | Persistence |
|---------|----------|-------------|
| `InMemoryStore` | Development, testing | Process lifetime only |
| `PostgresStore` | Production | Persistent (Neon serverless driver) |

## Configuration

### In-Memory

```ts
const memory = createMemory({
  maxMessages: 100,  // max messages per conversation (default: 100)
});
```

### Postgres

```ts
const memory = createMemory("postgres", {
  url: process.env.DATABASE_URL,  // Neon connection string
  tableName: "voltx_messages",    // custom table name (optional)
});
```

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
