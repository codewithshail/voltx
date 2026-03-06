// @voltx/ai — OpenAI provider

import type { AIProvider, ProviderConfig } from "../types.js";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";
import { resolveApiKey } from "./registry.js";

export function createOpenAIProvider(config: ProviderConfig = {}): AIProvider {
  return createOpenAICompatibleProvider({
    ...config,
    name: "openai",
    apiKey: config.apiKey ?? resolveApiKey("openai"),
    defaultBaseUrl: "https://api.openai.com/v1",
    supportsEmbeddings: true,
    supportsStreamOptions: true,
    supportsJsonSchema: true,
  });
}

/** Shorthand: openai("gpt-4o") returns a ModelRef */
export function openai(model: string) {
  return { provider: "openai", model, config: {} };
}