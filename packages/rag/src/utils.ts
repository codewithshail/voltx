// @voltx/rag — Utility functions

/**
 * Calculate cosine similarity between two embedding vectors.
 * Returns a value between -1 and 1, where 1 means identical direction.
 *
 * @example
 * ```ts
 * const score = cosineSimilarity(embeddingA, embeddingB);
 * // score ≈ 0.95 means very similar
 * ```
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `[voltx/rag] Vector dimension mismatch: ${a.length} vs ${b.length}`,
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Generate a deterministic chunk ID from content and index.
 * Useful for deduplication during re-ingestion.
 */
export function generateChunkId(prefix: string, index: number): string {
  return `${prefix}-chunk-${index}`;
}
