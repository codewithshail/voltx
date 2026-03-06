// @voltx/ai — Google Gemini provider
// Uses the OpenAI-compatible endpoint that Google provides

import type { AIProvider, ProviderConfig } from "../types.js";
import { createOpenAICompatibleProvider } from "./openai-compatible.js";
import { resolveApiKey } from "./registry.js";

export function createGoogleProvider(config: ProviderConfig = {}): AIProvider {
  const apiKey = config.apiKey ?? resolveApiKey("google");
  return createOpenAICompatibleProvider({
    ...config,
    name: "google",
    apiKey,
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    supportsEmbeddings: true,
    supportsStreamOptions: false,
    supportsJsonSchema: true,
  });
}

/** Shorthand: google("gemini-2.0-flash") returns a ModelRef */
export function google(model: string) {
  return { provider: "google", model, config: {} };
}