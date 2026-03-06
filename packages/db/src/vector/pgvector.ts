// @voltx/db — pgvector adapter (uses same Neon/Postgres DB)
//
// Requires the pgvector extension to be installed on the database:
//   CREATE EXTENSION IF NOT EXISTS vector;

import { neon } from "@neondatabase/serverless";
import type { VectorStore, VectorDocument, VectorSearchResult, PgVectorConfig } from "../types.js";

export class PgVectorStore implements VectorStore {
  name = "pgvector";
  private sql: ReturnType<typeof neon>;
  private tableName: string;
  private dimensions: number;
  private initialized = false;

  constructor(config: PgVectorConfig) {
    const url = config.url ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error("[voltx/db] Database URL required for pgvector. Set DATABASE_URL env or pass url.");
    }

    this.sql = neon(url);
    this.tableName = config.tableName ?? "voltx_embeddings";
    this.dimensions = config.dimensions ?? 1536;
  }

  /** Ensure the extension and table exist */
  private async ensureTable(): Promise<void> {
    if (this.initialized) return;

    await this.sql`CREATE EXTENSION IF NOT EXISTS vector`;

    // DDL statements can't use parameterized values for type definitions,
    // so we use sql.query() with a pre-validated string for the table/dimension.
    // tableName and dimensions are developer-controlled (not user input).
    await this.sql.query(
      `CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding vector(${this.dimensions}),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    );

    this.initialized = true;
  }

  async upsert(docs: VectorDocument[]): Promise<void> {
    await this.ensureTable();

    for (const doc of docs) {
      if (!doc.embedding || doc.embedding.length === 0) continue;

      const embeddingStr = `[${doc.embedding.join(",")}]`;
      const metadataJson = JSON.stringify(doc.metadata ?? {});

      // Use sql.query() because we need to interpolate the table name safely.
      // The table name is developer-controlled config, not user input.
      await this.sql.query(
        `INSERT INTO ${this.tableName} (id, content, embedding, metadata)
         VALUES ($1, $2, $3::vector, $4::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           content = EXCLUDED.content,
           embedding = EXCLUDED.embedding,
           metadata = EXCLUDED.metadata`,
        [doc.id, doc.content, embeddingStr, metadataJson],
      );
    }
  }

  async search(embedding: number[], topK = 5): Promise<VectorSearchResult[]> {
    await this.ensureTable();

    const embeddingStr = `[${embedding.join(",")}]`;

    const rows = await this.sql.query(
      `SELECT id, content, metadata,
              1 - (embedding <=> $1::vector) AS score
       FROM ${this.tableName}
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [embeddingStr, topK],
    ) as Array<{
      id: string;
      content: string;
      metadata: Record<string, unknown>;
      score: number;
    }>;

    return rows.map((row) => ({
      document: {
        id: row.id,
        content: row.content,
        metadata: row.metadata,
      },
      score: row.score,
    }));
  }

  async delete(ids: string[]): Promise<void> {
    await this.ensureTable();
    if (ids.length === 0) return;

    await this.sql.query(
      `DELETE FROM ${this.tableName} WHERE id = ANY($1)`,
      [ids],
    );
  }
}
