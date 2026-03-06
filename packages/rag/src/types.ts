// @voltx/rag — Core types

import type { VectorStore, VectorDocument } from "@voltx/db";

// ─── Document ────────────────────────────────────────────────────────────────

export interface DocumentChunk {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

// ─── Document Loaders ────────────────────────────────────────────────────────

export interface DocumentLoader {
  name: string;
  /** Load and return raw text from a source (file path, URL, or raw content) */
  load(source: string): Promise<string>;
}

// ─── Text Splitters ──────────────────────────────────────────────────────────

export interface TextSplitter {
  /** Split text into chunks */
  split(text: string): DocumentChunk[];
}

export interface CharacterSplitterOptions {
  /** Maximum characters per chunk (default: 1000) */
  chunkSize?: number;
  /** Overlap between chunks in characters (default: 200) */
  overlap?: number;
}

export interface RecursiveSplitterOptions {
  /** Maximum characters per chunk (default: 1000) */
  chunkSize?: number;
  /** Overlap between chunks in characters (default: 200) */
  overlap?: number;
  /**
   * Separators to try in order of preference.
   * Default: ["\n\n", "\n", ". ", " ", ""]
   */
  separators?: string[];
}

export interface MarkdownSplitterOptions {
  /** Maximum characters per chunk (default: 1500) */
  chunkSize?: number;
  /** Overlap between chunks in characters (default: 100) */
  overlap?: number;
  /** Whether to include header hierarchy in chunk metadata (default: true) */
  includeHeaders?: boolean;
}

// ─── Embedder ────────────────────────────────────────────────────────────────

export interface Embedder {
  name: string;
  /** Generate embedding vector for a single text */
  embed(text: string): Promise<number[]>;
  /** Batch embed multiple texts */
  embedBatch(texts: string[]): Promise<number[][]>;
}

export interface EmbedderConfig {
  /** Model string in "provider:model" format, e.g. "openai:text-embedding-3-small" */
  model: string;
}

// ─── RAG Pipeline ────────────────────────────────────────────────────────────

export interface RAGPipelineConfig {
  /** Document loader (optional — if omitted, source is treated as raw text) */
  loader?: DocumentLoader;
  /** Text splitter (default: RecursiveTextSplitter) */
  splitter?: TextSplitter;
  /** Embedder — wraps @voltx/ai embed/embedMany */
  embedder: Embedder;
  /** Vector store from @voltx/db */
  vectorStore: VectorStore;
}

export interface RAGQueryOptions {
  /** Number of results to return (default: 5) */
  topK?: number;
  /** Minimum similarity score threshold (0-1, default: 0) */
  minScore?: number;
  /** Metadata filter */
  filter?: Record<string, unknown>;
}

export interface RAGQueryResult {
  /** Retrieved source documents */
  sources: VectorDocument[];
  /** The query embedding (useful for debugging) */
  queryEmbedding?: number[];
}

export interface RAGIngestResult {
  /** Number of chunks ingested */
  chunks: number;
  /** Chunk IDs that were stored */
  ids: string[];
}
