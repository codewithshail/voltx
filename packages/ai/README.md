<p align="center">
  <strong>@voltx/ai</strong><br/>
  <em>Unified LLM provider abstraction with streaming, tool calling, and structured output</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/ai"><img src="https://img.shields.io/npm/v/@voltx/ai?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/ai"><img src="https://img.shields.io/npm/dm/@voltx/ai" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/ai" alt="license" /></a>
</p>

---

One API for every LLM. Part of the [VoltX](https://github.com/codewithshail/voltx) framework.

Write your AI code once, switch providers with a single string change. Supports text generation, streaming, tool calling, structured output, and embeddings.

## Installation

```bash
npm install @voltx/ai
```

## Supported Providers

| Provider | Chat | Streaming | Tool Calling | Embeddings |
|----------|------|-----------|-------------|------------|
| OpenAI | ✅ | ✅ | ✅ | ✅ |
| Anthropic | ✅ | ✅ | ✅ | — |
| Google Gemini | ✅ | ✅ | ✅ | ✅ |
| Cerebras | ✅ | ✅ | ✅ | — |
| OpenRouter | ✅ | ✅ | ✅ | — |
| Ollama | ✅ | ✅ | ✅ | ✅ |

## Quick Start

### Generate Text

```ts
import { generateText } from "@voltx/ai";

const { text } = await generateText({
  model: "openai:gpt-4o",
  prompt: "Explain TypeScript in one sentence.",
});
```

### Stream Text (SSE)

```ts
import { streamText } from "@voltx/ai";

const result = await streamText({
  model: "cerebras:llama3.1-8b",
  system: "You are a helpful assistant.",
  messages: [{ role: "user", content: "Hello!" }],
});

// Use in an HTTP endpoint
return result.toSSEResponse();
```

### Structured Output

```ts
import { generateObject } from "@voltx/ai";
import { z } from "zod";

const { object } = await generateObject({
  model: "openai:gpt-4o",
  prompt: "Generate a recipe for pasta.",
  schema: z.object({
    name: z.string(),
    ingredients: z.array(z.string()),
    steps: z.array(z.string()),
  }),
});
```

### Embeddings

```ts
import { embed, embedMany } from "@voltx/ai";

const { embedding } = await embed({
  model: "openai:text-embedding-3-small",
  value: "What is TypeScript?",
});

const { embeddings } = await embedMany({
  model: "openai:text-embedding-3-small",
  values: ["Hello", "World"],
});
```


### Provider Shorthands

```ts
import { openai, anthropic, cerebras, google, ollama } from "@voltx/ai";

// These are equivalent:
const result1 = await generateText({ model: "openai:gpt-4o", prompt: "Hi" });
const result2 = await generateText({ model: openai("gpt-4o"), prompt: "Hi" });
```

## API Reference

| Function | Description |
|----------|-------------|
| `generateText()` | Single LLM completion |
| `streamText()` | Streaming response with SSE helpers |
| `generateObject()` | Structured JSON output with Zod schema |
| `embed()` | Single text embedding |
| `embedMany()` | Batch text embeddings |

## Environment Variables

Set the API key for your provider:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=AIza...
CEREBRAS_API_KEY=csk-...
OPENROUTER_API_KEY=sk-or-...
```

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
