<p align="center">
  <strong>@voltx/db</strong><br/>
  <em>Database adapters — Drizzle ORM + Neon Postgres + Pinecone + pgvector</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/db"><img src="https://img.shields.io/npm/v/@voltx/db?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/db"><img src="https://img.shields.io/npm/dm/@voltx/db" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/db" alt="license" /></a>
</p>

---

Database layer for the [VoltX](https://github.com/codewithshail/voltx) framework. Provides a unified interface for relational databases (Drizzle ORM + Neon Postgres) and vector stores (Pinecone, pgvector, in-memory).

## Installation

```bash
npm install @voltx/db
```

## Quick Start

### Relational Database (Drizzle + Neon)

```ts
import { createDB } from "@voltx/db";

const db = createDB({ url: process.env.DATABASE_URL });

// Use Drizzle ORM queries
const users = await db.select().from(usersTable);
```

### Vector Store

```ts
import { createVectorStore } from "@voltx/db";

// In-memory (development)
const store = createVectorStore();

// Pinecone (production)
const store = createVectorStore("pinecone", {
  apiKey: process.env.PINECONE_API_KEY,
  indexName: "my-index",
});

// pgvector (self-hosted)
const store = createVectorStore("pgvector", {
  connectionString: process.env.DATABASE_URL,
});
```

### Vector Operations

```ts
// Store documents with embeddings
await store.upsert([
  { id: "doc-1", content: "Hello world", embedding: [0.1, 0.2, ...], metadata: {} },
]);

// Search by similarity
const results = await store.search(queryEmbedding, 5);
// → [{ document, score }, ...]

// Delete documents
await store.delete(["doc-1"]);
```

## Supported Backends

| Backend | Type | Use Case |
|---------|------|----------|
| Neon Postgres | Relational | Production database via Drizzle ORM |
| Pinecone | Vector | Managed vector search at scale |
| pgvector | Vector | Self-hosted vector search (same Postgres) |
| In-memory | Vector | Development and testing |

## Schema Helpers

Built-in Drizzle schema for common AI app tables:

```ts
import { conversationsTable, messagesTable, documentsTable } from "@voltx/db";
```

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
PINECONE_API_KEY=pc-...
PINECONE_INDEX=voltx-embeddings
```

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
