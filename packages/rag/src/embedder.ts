// @voltx/rag — Embedder (wraps @voltx/ai embed/embedMany)

import { embed, embedMany } from "@voltx/ai";
import type { Embedder, EmbedderConfig } from "./types.js";

/**
 * Creates an embedder that uses @voltx/ai under the hood.
 *
 * @example
 * ```ts
 * const embedder = createEmbedder({ model: "openai:text-embedding-3-small" });
 * const vector = await embedder.embed("Hello world");
 * const vectors = await embedder.embedBatch(["Hello", "World"]);
 * ```
 */
export function createEmbedder(config: EmbedderConfig): Embedder {
  const { model } = config;

  return {
    name: `voltx-embedder:${model}`,

    async embed(text: string): Promise<number[]> {
      const result = await embed({ model, value: text });
      return result.embedding;
    },

    async embedBatch(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      // Single text — use embed() for efficiency
      if (texts.length === 1) {
        const result = await embed({ model, value: texts[0] });
        return [result.embedding];
      }

      const result = await embedMany({ model, values: texts });
      return result.embeddings;
    },
  };
}
