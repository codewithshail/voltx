// @voltx/agents — LLM-powered ReAct agent loop with tool calling
//
// Usage:
//   import { createAgent } from "@voltx/agents";
//   const agent = createAgent({
//     name: "assistant",
//     model: "cerebras:llama3.1-8b",
//     instructions: "You are a helpful AI assistant.",
//     tools: [myTool],
//   });
//   const response = await agent.run("What's the weather?");

// ─── Agent ───────────────────────────────────────────────────────────────────

export { Agent } from "./agent.js";

// ─── Tracer ──────────────────────────────────────────────────────────────────

export { AgentTracer, generateRunId } from "./tracer.js";
export type { AgentTrace, TracerOptions } from "./tracer.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  Tool,
  AgentConfig,
  AgentResponse,
  AgentStep,
  AgentToolCall,
  AgentToolExecution,
  AgentFinishReason,
} from "./types.js";

// ─── Factory ─────────────────────────────────────────────────────────────────

import { Agent } from "./agent.js";
import type { AgentConfig } from "./types.js";

/** Create an agent instance */
export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}

// ─── Version ─────────────────────────────────────────────────────────────────

export const VERSION = "0.4.7";
