<p align="center">
  <strong>@voltx/agents</strong><br/>
  <em>LLM-powered ReAct agent loop with tool calling</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/agents"><img src="https://img.shields.io/npm/v/@voltx/agents?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/agents"><img src="https://img.shields.io/npm/dm/@voltx/agents" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/agents" alt="license" /></a>
</p>

---

Build autonomous AI agents that reason, use tools, and solve multi-step tasks. Part of the [VoltX](https://github.com/codewithshail/voltx) framework.

Uses the ReAct (Reason + Act) pattern: the agent calls an LLM, decides which tools to use, executes them, and loops until it has a final answer.

## Installation

```bash
npm install @voltx/agents
```

## Quick Start

```ts
import { createAgent } from "@voltx/agents";

const agent = createAgent({
  name: "assistant",
  model: "cerebras:llama3.1-8b",
  instructions: "You are a helpful AI assistant with access to tools.",
  tools: [
    {
      name: "get_weather",
      description: "Get current weather for a city",
      parameters: { type: "object", properties: { city: { type: "string" } } },
      execute: async ({ city }) => `Weather in ${city}: 72°F, sunny`,
    },
  ],
});

const response = await agent.run("What's the weather in San Francisco?");
console.log(response.content);
// → "The weather in San Francisco is 72°F and sunny."
```

## How It Works

```
1. User message → LLM (with system prompt + tools)
2. LLM responds with tool_calls? → Execute tools → Feed results back → Repeat
3. LLM responds with text (no tool_calls) → Return final answer
4. Max iterations reached → Return partial answer with warning
```

## Features

- **ReAct loop** — Reason + Act pattern with automatic tool execution
- **Any LLM provider** — Uses `@voltx/ai` under the hood (OpenAI, Anthropic, Cerebras, etc.)
- **Conversation memory** — Optional `@voltx/memory` integration for persistent context
- **Configurable limits** — Max iterations, temperature, token limits
- **Step tracking** — Full history of agent reasoning and tool calls
- **Streaming** — Stream agent responses via SSE

## Configuration

```ts
const agent = createAgent({
  name: "researcher",
  model: "openai:gpt-4o",
  instructions: "You are a research assistant.",
  tools: [searchTool, calculatorTool],
  memory: createMemory(),        // optional: conversation memory
  maxIterations: 10,             // default: 10
  temperature: 0.7,              // default: 0.7
});
```

## Agent Response

```ts
const response = await agent.run("Find the population of Tokyo");

response.content;      // Final text answer
response.steps;        // Array of reasoning + tool call steps
response.finishReason; // "stop" | "max_iterations" | "error"
response.usage;        // Token usage stats
```

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
