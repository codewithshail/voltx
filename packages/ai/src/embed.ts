// @voltx/ai — Embedding functions

import type { EmbedOptions, EmbedResult, EmbedManyOptions, EmbedManyResult } from "./types.js";
import { resolveModel, getProvider, resolveApiKey } from "./providers/registry.js";

/**
 * Generate an embedding vector for a single text.
 *
 * @example
 * ```ts
 * const { embedding } = await embed({
 *   model: "openai:text-embedding-3-small",
 *   value: "What is TypeScript?",
 * });
 * ```
 */
export async function embed(options: EmbedOptions): Promise<EmbedResult> {
  const ref = resolveModel(options.model);
  const apiKey = resolveApiKey(ref.provider, ref.config.apiKey);
  const provider = getProvider(ref.provider, { ...ref.config, apiKey });

  if (!provider.embed) {
    throw new Error(
      `[voltx/ai] Provider "${ref.provider}" does not support embeddings. Use openai, google, or ollama.`
    );
  }

  const response = await provider.embed({
    model: ref.model,
    input: options.value,
  });

  return {
    embedding: response.embeddings[0],
    usage: response.usage,
  };
}

/**
 * Generate embedding vectors for multiple texts in a single batch.
 *
 * @example
 * ```ts
 * const { embeddings } = await embedMany({
 *   model: "openai:text-embedding-3-small",
 *   values: ["Hello world", "TypeScript is great"],
 * });
 * ```
 */
export async function embedMany(options: EmbedManyOptions): Promise<EmbedManyResult> {
  const ref = resolveModel(options.model);
  const apiKey = resolveApiKey(ref.provider, ref.config.apiKey);
  const provider = getProvider(ref.provider, { ...ref.config, apiKey });

  if (!provider.embed) {
    throw new Error(
      `[voltx/ai] Provider "${ref.provider}" does not support embeddings. Use openai, google, or ollama.`
    );
  }

  const response = await provider.embed({
    model: ref.model,
    input: options.values,
  });

  return {
    embeddings: response.embeddings,
    usage: response.usage,
  };
}