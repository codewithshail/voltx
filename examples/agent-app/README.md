# Agent App Example

An AI agent with tool calling built with VoltX.

## Features

- ReAct agent loop with tool calling
- Calculator, web search, and weather tools
- Tool execution visualization

## Key Code

### Agent Definition

```ts
// agents/assistant.ts
import { createAgent } from "@voltx/agents";

export const assistant = createAgent({
  name: "assistant",
  model: "cerebras:llama3.1-8b",
  instructions: "You are a helpful assistant. Use your tools when needed.",
  tools: [calculatorTool, weatherTool],
  maxIterations: 5,
});
```

### API Route

```ts
// api/agent.ts
import type { Context } from "@voltx/server";
import { assistant } from "../agents/assistant";

export async function POST(c: Context) {
  const { input } = await c.req.json();
  const result = await assistant.run(input);
  return c.json({
    content: result.content,
    steps: result.steps,
    usage: result.usage,
  });
}
```

## Run

```bash
npx create-voltx-app my-agent --template agent-app --yes
cd my-agent
npm run dev
```
