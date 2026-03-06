<p align="center">
  <strong>@voltx/rag</strong><br/>
  <em>RAG pipeline — document loading, chunking, embedding, and retrieval</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/rag"><img src="https://img.shields.io/npm/v/@voltx/rag?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/rag"><img src="https://img.shields.io/npm/dm/@voltx/rag" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/rag" alt="license" /></a>
</p>

---

Production-ready Retrieval-Augmented Generation pipeline for the [VoltX](https://github.com/codewithshail/voltx) framework. Load documents, split into chunks, generate embeddings, store in a vector database, and retrieve relevant context for LLM prompts.

## Installation

```bash
npm install @voltx/rag
```

## Quick Start

```ts
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const pipeline = createRAGPipeline({
  embedder: createEmbedder({ model: "openai:text-embedding-3-small" }),
  vectorStore: createVectorStore(),
});

// Ingest documents
await pipeline.ingest("Your long document text here...");

// Query with natural language
const { sources } = await pipeline.query("What is TypeScript?");

// Or get formatted context for an LLM prompt
const context = await pipeline.getContext("What is TypeScript?");
```

## Features

### Document Loaders

| Loader | Description |
|--------|-------------|
| `TextLoader` | Plain text files or raw strings |
| `MarkdownLoader` | Markdown files (strips front-matter) |
| `JSONLoader` | JSON files (extracts text from configurable keys) |
| `WebLoader` | Fetches and extracts text from URLs |

### Text Splitters

| Splitter | Description |
|----------|-------------|
| `RecursiveTextSplitter` | Smart splitting with separator hierarchy (recommended) |
| `MarkdownSplitter` | Heading-aware splitting, preserves header hierarchy |
| `CharacterSplitter` | Simple character-based splitting with overlap |

### Fluent Document API

Inspired by [Mastra](https://mastra.ai)'s MDocument pattern:

```ts
import { MDocument, createEmbedder } from "@voltx/rag";

const doc = MDocument.fromMarkdown("# Title\n\nContent here...");
const chunks = doc.chunk({ strategy: "markdown", chunkSize: 500 });
const embedded = await doc.embed(createEmbedder({ model: "openai:text-embedding-3-small" }));
```

### Embedder

Wraps `@voltx/ai` embedding functions into a simple interface:

```ts
import { createEmbedder } from "@voltx/rag";

const embedder = createEmbedder({ model: "openai:text-embedding-3-small" });
const vector = await embedder.embed("Hello world");
const vectors = await embedder.embedBatch(["Hello", "World"]);
```

## Pipeline Options

```ts
const pipeline = createRAGPipeline({
  loader: new WebLoader(),                    // optional document loader
  splitter: new RecursiveTextSplitter({       // text splitter (default: recursive)
    chunkSize: 1000,
    overlap: 200,
  }),
  embedder: createEmbedder({ model: "openai:text-embedding-3-small" }),
  vectorStore: createVectorStore("pinecone", { indexName: "docs" }),
});

// Query with options
const results = await pipeline.query("question", { topK: 5, minScore: 0.7 });
```

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
