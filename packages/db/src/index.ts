// @voltx/db — Database adapters
// Drizzle ORM + Neon Postgres + Pinecone + pgvector + in-memory fallback

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  VectorDocument,
  VectorSearchResult,
  VectorStore,
  DatabaseConfig,
  PineconeConfig,
  PgVectorConfig,
} from "./types.js";

// ─── Drizzle ORM (Relational DB) ────────────────────────────────────────────

export { createDB, type DrizzleDB } from "./drizzle.js";

// ─── Default Schema Helpers ──────────────────────────────────────────────────

export { conversations, messages, documents } from "./schema.js";

// ─── Vector Store Implementations ────────────────────────────────────────────

export { InMemoryVectorStore } from "./vector/in-memory.js";
export { PineconeVectorStore } from "./vector/pinecone.js";
export { PgVectorStore } from "./vector/pgvector.js";

// ─── Drizzle ORM re-exports (convenience) ────────────────────────────────────
// So users don't need to install drizzle-orm separately for basic usage

export { eq, ne, gt, gte, lt, lte, and, or, not, sql, desc, asc } from "drizzle-orm";
export { cosineDistance, l2Distance, innerProduct } from "drizzle-orm";
export { pgTable, text, integer, timestamp, jsonb, boolean, index, vector } from "drizzle-orm/pg-core";

// ─── Vector Store Factory ────────────────────────────────────────────────────

import type { VectorStore, PineconeConfig, PgVectorConfig } from "./types.js";
import { InMemoryVectorStore } from "./vector/in-memory.js";
import { PineconeVectorStore } from "./vector/pinecone.js";
import { PgVectorStore } from "./vector/pgvector.js";

/**
 * Create a vector store instance.
 *
 * @example
 * ```ts
 * // In-memory (dev/testing)
 * const store = createVectorStore();
 *
 * // Pinecone (production)
 * const store = createVectorStore("pinecone", { apiKey: "...", indexName: "my-index" });
 *
 * // pgvector (self-hosted, uses same Postgres DB)
 * const store = createVectorStore("pgvector", { url: process.env.DATABASE_URL! });
 * ```
 */
export function createVectorStore(provider?: "in-memory"): InMemoryVectorStore;
export function createVectorStore(provider: "pinecone", config?: PineconeConfig): PineconeVectorStore;
export function createVectorStore(provider: "pgvector", config: PgVectorConfig): PgVectorStore;
export function createVectorStore(
  provider?: string,
  config?: PineconeConfig | PgVectorConfig,
): VectorStore {
  switch (provider) {
    case "pinecone":
      return new PineconeVectorStore(config as PineconeConfig);
    case "pgvector":
      return new PgVectorStore(config as PgVectorConfig);
    case "in-memory":
    default:
      return new InMemoryVectorStore();
  }
}

// ─── Version ─────────────────────────────────────────────────────────────────

export const VERSION = "0.3.0";
