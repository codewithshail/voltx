// @voltx/rag — MDocument (fluent document processing)
// Inspired by Mastra's MDocument pattern

import type { DocumentChunk, TextSplitter, Embedder } from "./types.js";
import { RecursiveTextSplitter, MarkdownSplitter, CharacterSplitter } from "./splitters.js";

export type ChunkStrategy = "recursive" | "character" | "markdown";

export interface ChunkOptions {
  /** Chunking strategy (default: "recursive") */
  strategy?: ChunkStrategy;
  /** Maximum chunk size in characters */
  chunkSize?: number;
  /** Overlap between chunks in characters */
  overlap?: number;
  /** Custom separators (recursive strategy only) */
  separators?: string[];
  /** Include header hierarchy in metadata (markdown strategy only) */
  includeHeaders?: boolean;
}

/**
 * Fluent document processing class.
 * Create from various formats, chunk, and embed in a pipeline.
 *
 * @example
 * ```ts
 * const doc = MDocument.fromText("Your long document...");
 * const chunks = doc.chunk({ strategy: "recursive", chunkSize: 500 });
 *
 * // Or from markdown
 * const mdDoc = MDocument.fromMarkdown("# Title\n\nContent...");
 * const mdChunks = mdDoc.chunk({ strategy: "markdown" });
 * ```
 */
export class MDocument {
  private content: string;
  private format: "text" | "markdown" | "json" | "html";
  private chunks: DocumentChunk[] | null = null;

  private constructor(content: string, format: "text" | "markdown" | "json" | "html") {
    this.content = content;
    this.format = format;
  }

  /** Create from plain text */
  static fromText(content: string): MDocument {
    return new MDocument(content, "text");
  }

  /** Create from markdown */
  static fromMarkdown(content: string): MDocument {
    return new MDocument(content, "markdown");
  }

  /** Create from JSON string */
  static fromJSON(content: string): MDocument {
    // Validate JSON
    JSON.parse(content);
    return new MDocument(content, "json");
  }

  /** Create from HTML (strips tags) */
  static fromHTML(html: string): MDocument {
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return new MDocument(text, "html");
  }

  /** Get the raw content */
  getContent(): string {
    return this.content;
  }

  /** Get the document format */
  getFormat(): string {
    return this.format;
  }

  /**
   * Split the document into chunks using the specified strategy.
   * Returns the chunks and caches them for subsequent embed() calls.
   */
  chunk(options: ChunkOptions = {}): DocumentChunk[] {
    const strategy = options.strategy ?? this.defaultStrategy();
    const splitter = this.createSplitter(strategy, options);
    this.chunks = splitter.split(this.content);
    return this.chunks;
  }

  /**
   * Embed the chunks using the provided embedder.
   * Must call chunk() first.
   */
  async embed(embedder: Embedder): Promise<DocumentChunk[]> {
    if (!this.chunks) {
      throw new Error("[voltx/rag] Call chunk() before embed()");
    }

    const texts = this.chunks.map((c) => c.content);
    const embeddings = await embedder.embedBatch(texts);

    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i].embedding = embeddings[i];
    }

    return this.chunks;
  }

  /** Get cached chunks (null if chunk() hasn't been called) */
  getChunks(): DocumentChunk[] | null {
    return this.chunks;
  }

  private defaultStrategy(): ChunkStrategy {
    if (this.format === "markdown") return "markdown";
    return "recursive";
  }

  private createSplitter(strategy: ChunkStrategy, options: ChunkOptions): TextSplitter {
    switch (strategy) {
      case "markdown":
        return new MarkdownSplitter({
          chunkSize: options.chunkSize,
          overlap: options.overlap,
          includeHeaders: options.includeHeaders,
        });
      case "character":
        return new CharacterSplitter({
          chunkSize: options.chunkSize,
          overlap: options.overlap,
        });
      case "recursive":
      default:
        return new RecursiveTextSplitter({
          chunkSize: options.chunkSize,
          overlap: options.overlap,
          separators: options.separators,
        });
    }
  }
}
