// @voltx/ai — Unified LLM provider abstraction
// Supports: OpenAI, Anthropic, Google Gemini, Cerebras, OpenRouter, Ollama

// ─── Core Functions ──────────────────────────────────────────────────────────

export { generateText } from "./generate-text.js";
export { streamText } from "./stream-text.js";
export { generateObject } from "./generate-object.js";
export { embed, embedMany } from "./embed.js";

// ─── Provider Shorthands ─────────────────────────────────────────────────────
// Usage: model: openai("gpt-4o") or model: "openai:gpt-4o"

export { openai } from "./providers/openai.js";
export { anthropic } from "./providers/anthropic.js";
export { google } from "./providers/google.js";
export { cerebras } from "./providers/cerebras.js";
export { openrouter } from "./providers/openrouter.js";
export { ollama } from "./providers/ollama.js";

// ─── Provider Factories (for custom config) ──────────────────────────────────

export { createOpenAIProvider } from "./providers/openai.js";
export { createAnthropicProvider } from "./providers/anthropic.js";
export { createGoogleProvider } from "./providers/google.js";
export { createCerebrasProvider } from "./providers/cerebras.js";
export { createOpenRouterProvider } from "./providers/openrouter.js";
export { createOllamaProvider } from "./providers/ollama.js";

// ─── Registry (for custom providers) ─────────────────────────────────────────

export { registerProvider, getProvider, resolveModel } from "./providers/registry.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  // Messages
  Message,
  TextContent,
  ImageContent,
  ContentPart,
  // Tools
  ToolDefinition,
  ToolCallResult,
  ParsedToolCall,
  // Generate Text
  GenerateTextOptions,
  GenerateTextResult,
  // Stream Text
  StreamTextOptions,
  StreamTextResult,
  // Generate Object
  GenerateObjectOptions,
  GenerateObjectResult,
  // Embeddings
  EmbedOptions,
  EmbedResult,
  EmbedManyOptions,
  EmbedManyResult,
  // Provider
  AIProvider,
  ProviderConfig,
  ModelRef,
  TokenUsage,
  FinishReason,
  StreamChunk,
} from "./types.js";

// ─── Auto-register all built-in providers ────────────────────────────────────

import { registerProvider } from "./providers/registry.js";
import { createOpenAIProvider } from "./providers/openai.js";
import { createAnthropicProvider } from "./providers/anthropic.js";
import { createGoogleProvider } from "./providers/google.js";
import { createCerebrasProvider } from "./providers/cerebras.js";
import { createOpenRouterProvider } from "./providers/openrouter.js";
import { createOllamaProvider } from "./providers/ollama.js";

registerProvider("openai", createOpenAIProvider);
registerProvider("anthropic", createAnthropicProvider);
registerProvider("google", createGoogleProvider);
registerProvider("cerebras", createCerebrasProvider);
registerProvider("openrouter", createOpenRouterProvider);
registerProvider("ollama", createOllamaProvider);

// ─── Version ─────────────────────────────────────────────────────────────────

export const VERSION = "0.4.6";