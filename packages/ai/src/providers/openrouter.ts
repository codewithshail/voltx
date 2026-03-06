// @voltx/ai — OpenRouter provider
// OpenRouter uses OpenAI-compatible API format with extra headers

import type { AIProvider, ProviderConfig } from "../types.js";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";
import { resolveApiKey } from "./registry.js";

export function createOpenRouterProvider(config: ProviderConfig = {}): AIProvider {
  return createOpenAICompatibleProvider({
    ...config,
    name: "openrouter",
    apiKey: config.apiKey ?? resolveApiKey("openrouter"),
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    headers: {
      "HTTP-Referer": "https://voltx.co.in",
      "X-Title": "VoltX AI Framework",
      ...config.headers,
    },
    supportsEmbeddings: false,
    supportsStreamOptions: true,
    supportsJsonSchema: true,
  });
}

/** Shorthand: openrouter("meta-llama/llama-4-scout") returns a ModelRef */
export function openrouter(model: string) {
  return { provider: "openrouter", model, config: {} };
}