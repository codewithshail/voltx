// @voltx/ai — Cerebras provider
// Cerebras uses OpenAI-compatible API format

import type { AIProvider, ProviderConfig } from "../types.js";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";
import { resolveApiKey } from "./registry.js";

export function createCerebrasProvider(config: ProviderConfig = {}): AIProvider {
  return createOpenAICompatibleProvider({
    ...config,
    name: "cerebras",
    apiKey: config.apiKey ?? resolveApiKey("cerebras"),
    defaultBaseUrl: "https://api.cerebras.ai/v1",
    supportsEmbeddings: false,
    supportsStreamOptions: false,
    supportsJsonSchema: true,
  });
}

/** Shorthand: cerebras("llama3.1-8b") returns a ModelRef */
export function cerebras(model: string) {
  return { provider: "cerebras", model, config: {} };
}