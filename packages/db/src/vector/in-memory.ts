// @voltx/db — In-memory vector store (dev / testing fallback)

import type { VectorStore, VectorDocument, VectorSearchResult } from "../types.js";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`,
    );
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;
  return dot / magnitude;
}

export class InMemoryVectorStore implements VectorStore {
  name = "in-memory";
  private store = new Map<string, VectorDocument>();

  async upsert(docs: VectorDocument[]): Promise<void> {
    for (const doc of docs) {
      this.store.set(doc.id, doc);
    }
  }

  async search(embedding: number[], topK = 5): Promise<VectorSearchResult[]> {
    const results: VectorSearchResult[] = [];
    for (const doc of this.store.values()) {
      if (!doc.embedding) continue;
      const score = cosineSimilarity(embedding, doc.embedding);
      results.push({ document: doc, score });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.store.delete(id);
    }
  }

  /** Number of documents in the store */
  count(): number {
    return this.store.size;
  }

  /** List all document IDs */
  listIds(): string[] {
    return Array.from(this.store.keys());
  }

  /** Clear all documents */
  clear(): void {
    this.store.clear();
  }
}
