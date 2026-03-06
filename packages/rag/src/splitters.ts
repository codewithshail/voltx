// @voltx/rag — Text splitters
// Inspired by LangChain RecursiveCharacterTextSplitter and Mastra chunk strategies

import type {
  TextSplitter,
  DocumentChunk,
  CharacterSplitterOptions,
  RecursiveSplitterOptions,
  MarkdownSplitterOptions,
} from "./types.js";

// ─── Character Splitter ──────────────────────────────────────────────────────

/**
 * Simple character-based text splitter with smart boundary detection.
 * Tries to split at sentence/paragraph boundaries near the chunk size.
 */
export class CharacterSplitter implements TextSplitter {
  private chunkSize: number;
  private overlap: number;

  constructor(options: CharacterSplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 1000;
    this.overlap = options.overlap ?? 200;
  }

  private findBreakPoint(text: string, pos: number): number {
    if (pos >= text.length) return text.length;

    const searchStart = Math.max(0, pos - Math.floor(this.chunkSize * 0.2));

    // Look for sentence boundaries
    for (let i = pos; i >= searchStart; i--) {
      const ch = text[i];
      if (
        (ch === "." || ch === "!" || ch === "?") &&
        (i + 1 >= text.length || /\s/.test(text[i + 1]))
      ) {
        return i + 1;
      }
      if (ch === "\n" && i > 0 && text[i - 1] === "\n") {
        return i + 1;
      }
    }

    // Fall back to word boundary
    for (let i = pos; i >= searchStart; i--) {
      if (/\s/.test(text[i])) return i + 1;
    }

    return pos;
  }

  split(text: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
      const rawEnd = Math.min(start + this.chunkSize, text.length);
      const end = rawEnd >= text.length ? rawEnd : this.findBreakPoint(text, rawEnd);
      const content = text.slice(start, end).trim();

      if (content.length > 0) {
        chunks.push({
          id: `chunk-${index++}`,
          content,
          metadata: { start, end, splitter: "character" },
        });
      }

      const step = end - start - this.overlap;
      start += step > 0 ? step : end - start;
    }

    return chunks;
  }
}

// ─── Recursive Text Splitter ─────────────────────────────────────────────────

/**
 * Recursively splits text using a hierarchy of separators.
 * Tries to keep semantically related text together by splitting on
 * paragraph breaks first, then newlines, then sentences, then words.
 *
 * This is the recommended splitter for generic text (same approach as
 * LangChain's RecursiveCharacterTextSplitter).
 */
export class RecursiveTextSplitter implements TextSplitter {
  private chunkSize: number;
  private overlap: number;
  private separators: string[];

  constructor(options: RecursiveSplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 1000;
    this.overlap = options.overlap ?? 200;
    this.separators = options.separators ?? ["\n\n", "\n", ". ", " ", ""];
  }

  split(text: string): DocumentChunk[] {
    const rawChunks = this.splitText(text, this.separators);
    const merged = this.mergeWithOverlap(rawChunks);

    return merged.map((content, i) => ({
      id: `chunk-${i}`,
      content,
      metadata: { index: i, splitter: "recursive" },
    }));
  }

  /**
   * Recursively split text. Try the first separator; if any resulting piece
   * is still too large, recurse with the next separator in the list.
   */
  private splitText(text: string, separators: string[]): string[] {
    const results: string[] = [];

    // Find the best separator that actually exists in the text
    let bestSep = "";
    let bestIdx = 0;
    for (let i = 0; i < separators.length; i++) {
      const sep = separators[i];
      if (sep === "") {
        bestSep = sep;
        bestIdx = i;
        break;
      }
      if (text.includes(sep)) {
        bestSep = sep;
        bestIdx = i;
        break;
      }
    }

    // Split on the chosen separator
    const pieces = bestSep === "" ? [...text] : text.split(bestSep);
    const remainingSeps = separators.slice(bestIdx + 1);

    let current = "";
    for (const piece of pieces) {
      const candidate = current ? current + bestSep + piece : piece;

      if (candidate.length <= this.chunkSize) {
        current = candidate;
      } else {
        // Flush current if it has content
        if (current.trim()) {
          results.push(current.trim());
        }

        // If this single piece is too large and we have more separators, recurse
        if (piece.length > this.chunkSize && remainingSeps.length > 0) {
          const subChunks = this.splitText(piece, remainingSeps);
          results.push(...subChunks);
          current = "";
        } else {
          current = piece;
        }
      }
    }

    if (current.trim()) {
      results.push(current.trim());
    }

    return results;
  }

  /**
   * Merge chunks with overlap to maintain context between adjacent chunks.
   */
  private mergeWithOverlap(chunks: string[]): string[] {
    if (this.overlap <= 0 || chunks.length <= 1) return chunks;

    const result: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0) {
        result.push(chunks[i]);
      } else {
        // Take the last `overlap` characters from the previous chunk as prefix
        const prev = chunks[i - 1];
        const overlapText = prev.slice(-this.overlap);
        // Find a clean word boundary in the overlap
        const spaceIdx = overlapText.indexOf(" ");
        const cleanOverlap = spaceIdx >= 0 ? overlapText.slice(spaceIdx + 1) : overlapText;
        result.push((cleanOverlap + " " + chunks[i]).trim());
      }
    }
    return result;
  }
}

// ─── Markdown Splitter ───────────────────────────────────────────────────────

/**
 * Markdown-aware text splitter that respects heading hierarchy.
 * Splits on headings first, then falls back to paragraph/sentence boundaries
 * within sections that exceed the chunk size.
 */
export class MarkdownSplitter implements TextSplitter {
  private chunkSize: number;
  private overlap: number;
  private includeHeaders: boolean;

  constructor(options: MarkdownSplitterOptions = {}) {
    this.chunkSize = options.chunkSize ?? 1500;
    this.overlap = options.overlap ?? 100;
    this.includeHeaders = options.includeHeaders ?? true;
  }

  split(text: string): DocumentChunk[] {
    const sections = this.splitByHeadings(text);
    const chunks: DocumentChunk[] = [];
    let index = 0;

    const fallback = new RecursiveTextSplitter({
      chunkSize: this.chunkSize,
      overlap: this.overlap,
    });

    for (const section of sections) {
      if (section.content.length <= this.chunkSize) {
        chunks.push({
          id: `chunk-${index++}`,
          content: section.content.trim(),
          metadata: {
            ...section.headers,
            splitter: "markdown",
          },
        });
      } else {
        // Section too large — sub-split with recursive splitter
        const subChunks = fallback.split(section.content);
        for (const sub of subChunks) {
          chunks.push({
            id: `chunk-${index++}`,
            content: sub.content.trim(),
            metadata: {
              ...section.headers,
              ...sub.metadata,
              splitter: "markdown",
            },
          });
        }
      }
    }

    return chunks.filter((c) => c.content.length > 0);
  }

  private splitByHeadings(
    text: string,
  ): Array<{ content: string; headers: Record<string, string> }> {
    const lines = text.split("\n");
    const sections: Array<{ content: string; headers: Record<string, string> }> = [];
    const headerStack: Record<string, string> = {};
    let currentContent = "";

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headerMatch) {
        // Flush previous section
        if (currentContent.trim()) {
          sections.push({
            content: this.includeHeaders
              ? this.buildHeaderPrefix(headerStack) + currentContent.trim()
              : currentContent.trim(),
            headers: { ...headerStack },
          });
        }

        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();

        // Clear lower-level headers when a higher-level one appears
        for (let i = level; i <= 6; i++) {
          delete headerStack[`h${i}`];
        }
        headerStack[`h${level}`] = title;
        currentContent = "";
      } else {
        currentContent += line + "\n";
      }
    }

    // Flush last section
    if (currentContent.trim()) {
      sections.push({
        content: this.includeHeaders
          ? this.buildHeaderPrefix(headerStack) + currentContent.trim()
          : currentContent.trim(),
        headers: { ...headerStack },
      });
    }

    return sections;
  }

  private buildHeaderPrefix(headers: Record<string, string>): string {
    const parts: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const h = headers[`h${i}`];
      if (h) parts.push(h);
    }
    return parts.length > 0 ? parts.join(" > ") + "\n\n" : "";
  }
}
