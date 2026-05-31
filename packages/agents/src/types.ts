// @voltx/agents — Core types

import type { MemoryStore } from "@voltx/memory";
import type { TokenUsage, FinishReason } from "@voltx/ai";
import type { AgentTracer } from "./tracer.js";

// ─── Tool ────────────────────────────────────────────────────────────────────

export interface Tool {
  name: string;
  description: string;
  /** JSON Schema for the tool's parameters */
  parameters?: Record<string, unknown>;
  /** Execute the tool with parsed arguments */
  execute(params: Record<string, unknown>): Promise<unknown>;
}

// ─── Agent Config ────────────────────────────────────────────────────────────

export interface AgentConfig {
  /** Agent name (used in logs and identification) */
  name: string;
  /** System prompt / instructions for the LLM */
  instructions: string;
  /** Model to use (e.g. "cerebras:llama3.1-8b", "openai:gpt-4o") */
  model: string;
  /** Available tools the agent can call */
  tools?: Tool[];
  /** Memory store for conversation history */
  memory?: MemoryStore;
  /** Max ReAct loop iterations before stopping (default: 10) */
  maxIterations?: number;
  /** Temperature for LLM calls (default: 0.7) */
  temperature?: number;
  /** Max tokens per LLM call */
  maxTokens?: number;
  /** Tracer for observability and cost tracking */
  tracer?: AgentTracer;
  /** Called when a tool is about to be executed */
  onToolCall?: (toolName: string, args: Record<string, unknown>) => void;
  /** Called when a tool returns a result */
  onToolResult?: (toolName: string, result: unknown) => void;
  /** Called on each iteration step */
  onStep?: (step: AgentStep) => void;
}

// ─── Agent Response ──────────────────────────────────────────────────────────

export interface AgentResponse {
  /** Final text response from the agent */
  content: string;
  /** All steps the agent took (LLM calls + tool executions) */
  steps: AgentStep[];
  /** Total token usage across all LLM calls */
  usage: TokenUsage;
  /** Why the agent stopped */
  finishReason: AgentFinishReason;
}

export type AgentFinishReason =
  | "complete"       // LLM returned text with no tool calls
  | "max_iterations" // Hit maxIterations limit
  | "error"          // An error occurred
  | "aborted";       // Cancelled via AbortSignal

export interface AgentStep {
  /** Step number (1-indexed) */
  index: number;
  /** Type of step */
  type: "llm_call" | "tool_call";
  /** For llm_call: the LLM's response text (may be empty if tool_calls) */
  text?: string;
  /** For llm_call: tool calls the LLM requested */
  toolCalls?: AgentToolCall[];
  /** For tool_call: the tool execution details */
  toolExecution?: AgentToolExecution;
  /** Token usage for this step's LLM call */
  usage?: TokenUsage;
  /** Finish reason from the LLM */
  finishReason?: FinishReason;
  /** Timestamp */
  timestamp: number;
}

export interface AgentToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AgentToolExecution {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  /** Duration in ms */
  durationMs: number;
  error?: string;
}

// Re-export memory types for convenience
export type { MemoryStore };
