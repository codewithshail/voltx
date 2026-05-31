# RAG App Example

A document Q&A app with RAG (Retrieval-Augmented Generation).

## Features

- Document ingestion and chunking
- Embedding-based vector search
- Context-augmented answers

## Key Code

### RAG Pipeline

```ts
// lib/rag.ts
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const vectorStore = createVectorStore();
const embedder = createEmbedder({ model: "openai:text-embedding-3-small" });
export const rag = createRAGPipeline({ embedder, vectorStore });
```

### Ingest & Query

```ts
// api/rag/ingest.ts
export async function POST(c: Context) {
  const { text } = await c.req.json();
  const result = await rag.ingest(text, "doc");
  return c.json({ chunks: result.chunks });
}

// api/rag/query.ts
export async function POST(c: Context) {
  const { question } = await c.req.json();
  const context = await rag.getContext(question, { topK: 5 });

  const response = await generateText({
    model: "openai:gpt-4o",
    system: "Answer using the provided context only.",
    prompt: `Context:\n${context}\n\nQuestion: ${question}`,
  });

  return c.json({ answer: response.text, context });
}
```

## Run

```bash
npx create-voltx-app my-rag --template rag-app --yes
cd my-rag
npm run dev
```
