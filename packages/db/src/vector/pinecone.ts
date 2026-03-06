// @voltx/db — Pinecone vector store adapter
//
// Usage:
//   import { PineconeVectorStore } from "@voltx/db";
//   const store = new PineconeVectorStore({ apiKey: "...", indexName: "my-index" });
//   await store.upsert([{ id: "1", content: "hello", embedding: [...] }]);
//   const results = await store.search([0.1, 0.2, ...], 5);

import { Pinecone } from "@pinecone-database/pinecone";
import type { VectorStore, VectorDocument, VectorSearchResult, PineconeConfig } from "../types.js";

export class PineconeVectorStore implements VectorStore {
  name = "pinecone";
  private client: Pinecone;
  private indexName: string;
  private namespace: string | undefined;

  constructor(config: PineconeConfig = {}) {
    const apiKey = config.apiKey ?? process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error("[voltx/db] Pinecone API key required. Set PINECONE_API_KEY env or pass apiKey.");
    }

    this.client = new Pinecone({ apiKey });
    this.indexName = config.indexName ?? process.env.PINECONE_INDEX ?? "voltx-embeddings";
    this.namespace = config.namespace;
  }

  private getIndex() {
    const idx = this.client.index(this.indexName);
    return this.namespace ? idx.namespace(this.namespace) : idx;
  }

  async upsert(docs: VectorDocument[]): Promise<void> {
    const vectors = docs
      .filter((d) => d.embedding && d.embedding.length > 0)
      .map((d) => ({
        id: d.id,
        values: d.embedding!,
        metadata: {
          content: d.content,
          ...(d.metadata ?? {}),
        } as Record<string, string | number | boolean | string[]>,
      }));

    if (vectors.length === 0) return;

    const idx = this.getIndex();

    // Pinecone recommends batches of 100
    for (let i = 0; i < vectors.length; i += 100) {
      const batch = vectors.slice(i, i + 100);
      await idx.upsert({ records: batch });
    }
  }

  async search(embedding: number[], topK = 5): Promise<VectorSearchResult[]> {
    const idx = this.getIndex();

    const result = await idx.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    return (result.matches ?? []).map((match) => ({
      document: {
        id: match.id,
        content: (match.metadata?.content as string) ?? "",
        embedding: match.values ?? undefined,
        metadata: match.metadata as Record<string, unknown> | undefined,
      },
      score: match.score ?? 0,
    }));
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const idx = this.getIndex();
    await idx.deleteMany({ ids });
  }
}
