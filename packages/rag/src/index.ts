// @voltx/rag — RAG pipeline primitives
// Document loading, chunking, embedding, and retrieval

import type { VectorStore, VectorDocument } from "@voltx/db";
import type {
  Embedder,
  RAGPipelineConfig,
  RAGQueryOptions,
  RAGQueryResult,
  RAGIngestResult,
  TextSplitter,
  DocumentLoader,
} from "./types.js";
import { RecursiveTextSplitter } from "./splitters.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  DocumentChunk,
  DocumentLoader,
  TextSplitter,
  Embedder,
  EmbedderConfig,
  RAGPipelineConfig,
  RAGQueryOptions,
  RAGQueryResult,
  RAGIngestResult,
  CharacterSplitterOptions,
  RecursiveSplitterOptions,
  MarkdownSplitterOptions,
} from "./types.js";

// ─── Splitters ───────────────────────────────────────────────────────────────

export { CharacterSplitter, RecursiveTextSplitter, MarkdownSplitter } from "./splitters.js";

// ─── Document Loaders ────────────────────────────────────────────────────────

export { TextLoader, MarkdownLoader, JSONLoader, WebLoader } from "./loaders.js";
export type { JSONLoaderOptions } from "./loaders.js";

// ─── Embedder Factory ────────────────────────────────────────────────────────

export { createEmbedder } from "./embedder.js";

// ─── MDocument (fluent API) ──────────────────────────────────────────────────

export { MDocument } from "./document.js";
export type { ChunkOptions, ChunkStrategy } from "./document.js";

// ─── Utilities ───────────────────────────────────────────────────────────────

export { cosineSimilarity } from "./utils.js";

// ─── RAG Pipeline ────────────────────────────────────────────────────────────

export class RAGPipeline {
  private loader: DocumentLoader | undefined;
  private splitter: TextSplitter;
  private embedder: Embedder;
  private vectorStore: VectorStore;

  constructor(config: RAGPipelineConfig) {
    this.loader = config.loader;
    this.splitter = config.splitter ?? new RecursiveTextSplitter();
    this.embedder = config.embedder;
    this.vectorStore = config.vectorStore;
  }

  /**
   * Ingest a document: load → split → embed (batch) → store in vector DB.
   *
   * @param source - File path, URL, or raw text (depends on loader)
   * @param idPrefix - Optional prefix for chunk IDs (default: "doc")
   * @returns Number of chunks ingested and their IDs
   */
  async ingest(source: string, idPrefix = "doc"): Promise<RAGIngestResult> {
    const text = this.loader ? await this.loader.load(source) : source;
    const chunks = this.splitter.split(text);

    // Batch embed all chunks
    const texts = chunks.map((c) => c.content);
    const embeddings = await this.embedder.embedBatch(texts);

    const docs: VectorDocument[] = chunks.map((chunk, i) => ({
      id: `${idPrefix}-${chunk.id}`,
      content: chunk.content,
      embedding: embeddings[i],
      metadata: chunk.metadata,
    }));

    await this.vectorStore.upsert(docs);

    return {
      chunks: docs.length,
      ids: docs.map((d) => d.id),
    };
  }

  /**
   * Query: embed question → search vector store → return ranked sources.
   *
   * @param question - The user's question
   * @param options - Query options (topK, minScore)
   */
  async query(question: string, options: RAGQueryOptions = {}): Promise<RAGQueryResult> {
    const { topK = 5, minScore = 0 } = options;

    const queryEmbedding = await this.embedder.embed(question);
    const results = await this.vectorStore.search(queryEmbedding, topK);

    // Filter by minimum score if specified
    const filtered = minScore > 0
      ? results.filter((r) => r.score >= minScore)
      : results;

    return {
      sources: filtered.map((r) => r.document),
      queryEmbedding,
    };
  }

  /**
   * Convenience: query + format sources into a context string for LLM prompts.
   */
  async getContext(question: string, options: RAGQueryOptions = {}): Promise<string> {
    const { sources } = await this.query(question, options);

    if (sources.length === 0) {
      return "No relevant context found.";
    }

    return sources
      .map((s, i) => `[Source ${i + 1}]\n${s.content}`)
      .join("\n\n---\n\n");
  }

  /**
   * Delete documents from the vector store by IDs.
   */
  async delete(ids: string[]): Promise<void> {
    await this.vectorStore.delete(ids);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a RAG pipeline.
 *
 * @example
 * ```ts
 * import { createRAGPipeline, createEmbedder } from "@voltx/rag";
 * import { createVectorStore } from "@voltx/db";
 *
 * const pipeline = createRAGPipeline({
 *   embedder: createEmbedder({ model: "openai:text-embedding-3-small" }),
 *   vectorStore: createVectorStore("pinecone", { indexName: "my-index" }),
 * });
 *
 * // Ingest documents
 * await pipeline.ingest("Your long document text here...");
 *
 * // Query
 * const { sources } = await pipeline.query("What is TypeScript?");
 *
 * // Or get formatted context for LLM
 * const context = await pipeline.getContext("What is TypeScript?");
 * ```
 */
export function createRAGPipeline(config: RAGPipelineConfig): RAGPipeline {
  return new RAGPipeline(config);
}

// ─── Version ─────────────────────────────────────────────────────────────────

export const VERSION = "0.4.7";
