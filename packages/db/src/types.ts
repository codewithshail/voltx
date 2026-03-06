// @voltx/db — Core types

// ─── Vector Store ────────────────────────────────────────────────────────────

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  document: VectorDocument;
  score: number;
}

export interface VectorStore {
  name: string;
  /** Insert or update documents with embeddings */
  upsert(docs: VectorDocument[]): Promise<void>;
  /** Search by embedding vector */
  search(embedding: number[], topK?: number): Promise<VectorSearchResult[]>;
  /** Delete documents by ID */
  delete(ids: string[]): Promise<void>;
}

// ─── Database ────────────────────────────────────────────────────────────────

export interface DatabaseConfig {
  /** Postgres connection string (Neon or local) */
  url: string;
}

export interface PineconeConfig {
  /** Pinecone API key (reads from PINECONE_API_KEY env if not set) */
  apiKey?: string;
  /** Pinecone index name (reads from PINECONE_INDEX env if not set) */
  indexName?: string;
  /** Namespace within the index */
  namespace?: string;
}

export interface PgVectorConfig {
  /** Postgres connection string (same DB, must have pgvector extension) */
  url: string;
  /** Table name for vector storage (default: "voltx_embeddings") */
  tableName?: string;
  /** Vector dimensions (default: 1536 for OpenAI) */
  dimensions?: number;
}
