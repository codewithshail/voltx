// @voltx/ai — Ollama provider (local models)
// Ollama uses OpenAI-compatible API format

import type { AIProvider, ProviderConfig } from "../types.js";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";

export function createOllamaProvider(config: ProviderConfig = {}): AIProvider {
  return createOpenAICompatibleProvider({
    name: "ollama",
    baseUrl: config.baseUrl,
    headers: config.headers,
    defaultBaseUrl: "http://localhost:11434/v1",
    supportsEmbeddings: true,
    supportsStreamOptions: false,
    supportsJsonSchema: false,
  });
}

/** Shorthand: ollama("llama3") returns a ModelRef */
export function ollama(model: string) {
  return { provider: "ollama", model, config: {} };
}