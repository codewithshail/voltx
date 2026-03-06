// @voltx/ai — Provider registry + model string parser

import type { AIProvider, ModelRef, ProviderConfig } from "../types.js";

// ─── Registry ────────────────────────────────────────────────────────────────

const providers = new Map<string, (config: ProviderConfig) => AIProvider>();

export function registerProvider(
  name: string,
  factory: (config: ProviderConfig) => AIProvider
): void {
  providers.set(name, factory);
}

export function getProvider(name: string, config: ProviderConfig = {}): AIProvider {
  const factory = providers.get(name);
  if (!factory) {
    const available = Array.from(providers.keys()).join(", ");
    throw new Error(
      `[voltx/ai] Unknown provider "${name}". Available: ${available}`
    );
  }
  return factory(config);
}

// ─── Model String Parser ─────────────────────────────────────────────────────
// Parses "provider:model" strings like "openai:gpt-4o" or "cerebras:llama3.1-8b"

export function resolveModel(model: string | ModelRef): ModelRef {
  if (typeof model !== "string") return model;

  const colonIndex = model.indexOf(":");
  if (colonIndex === -1) {
    // No provider prefix — default to openai
    return { provider: "openai", model, config: {} };
  }

  const provider = model.slice(0, colonIndex);
  const modelName = model.slice(colonIndex + 1);
  return { provider, model: modelName, config: {} };
}

// ─── Env Key Resolver ────────────────────────────────────────────────────────
// Auto-reads API keys from environment variables

const ENV_KEY_MAP: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  ollama: "", // no key needed
};

export function resolveApiKey(provider: string, explicit?: string): string | undefined {
  if (explicit) return explicit;
  const envKey = ENV_KEY_MAP[provider];
  if (!envKey) return undefined;
  return process.env[envKey];
}