// @voltx/rag — Document loaders

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { DocumentLoader } from "./types.js";

// ─── Text File Loader ────────────────────────────────────────────────────────

/**
 * Loads plain text from a file path or treats the source as raw text.
 */
export class TextLoader implements DocumentLoader {
  name = "text";

  async load(source: string): Promise<string> {
    if (existsSync(source)) {
      return readFile(source, "utf-8");
    }
    // Treat as raw text
    return source;
  }
}

// ─── Markdown Loader ─────────────────────────────────────────────────────────

/**
 * Loads markdown files. Strips front-matter (YAML between --- delimiters)
 * and returns the markdown body.
 */
export class MarkdownLoader implements DocumentLoader {
  name = "markdown";

  async load(source: string): Promise<string> {
    let text: string;
    if (existsSync(source)) {
      text = await readFile(source, "utf-8");
    } else {
      text = source;
    }

    // Strip YAML front-matter
    const frontMatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
    return text.replace(frontMatterRegex, "").trim();
  }
}

// ─── JSON Loader ─────────────────────────────────────────────────────────────

export interface JSONLoaderOptions {
  /** JSON path keys to extract text from (e.g. ["content", "text", "body"]) */
  textKeys?: string[];
  /** Separator between extracted values (default: "\n\n") */
  separator?: string;
}

/**
 * Loads JSON files and extracts text content from specified keys.
 * Handles both single objects and arrays of objects.
 */
export class JSONLoader implements DocumentLoader {
  name = "json";
  private textKeys: string[];
  private separator: string;

  constructor(options: JSONLoaderOptions = {}) {
    this.textKeys = options.textKeys ?? ["content", "text", "body", "description"];
    this.separator = options.separator ?? "\n\n";
  }

  async load(source: string): Promise<string> {
    let raw: string;
    if (existsSync(source)) {
      raw = await readFile(source, "utf-8");
    } else {
      raw = source;
    }

    const data = JSON.parse(raw) as unknown;
    const texts = this.extractTexts(data);
    return texts.join(this.separator);
  }

  private extractTexts(data: unknown): string[] {
    const results: string[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        results.push(...this.extractTexts(item));
      }
    } else if (data !== null && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      for (const key of this.textKeys) {
        if (key in obj && typeof obj[key] === "string") {
          results.push(obj[key] as string);
        }
      }
      // If no text keys matched, recurse into all values
      if (results.length === 0) {
        for (const value of Object.values(obj)) {
          if (typeof value === "string" && value.length > 20) {
            results.push(value);
          } else if (typeof value === "object" && value !== null) {
            results.push(...this.extractTexts(value));
          }
        }
      }
    } else if (typeof data === "string") {
      results.push(data);
    }

    return results;
  }
}

// ─── Web Loader ──────────────────────────────────────────────────────────────

/**
 * Fetches text content from a URL. Strips HTML tags for basic text extraction.
 */
export class WebLoader implements DocumentLoader {
  name = "web";

  async load(source: string): Promise<string> {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`[voltx/rag] WebLoader failed to fetch ${source}: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    // If HTML, do basic tag stripping
    if (contentType.includes("text/html")) {
      return this.stripHTML(text);
    }

    return text;
  }

  private stripHTML(html: string): string {
    return (
      html
        // Remove script and style blocks
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        // Remove HTML tags
        .replace(/<[^>]+>/g, " ")
        // Decode common entities
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        // Collapse whitespace
        .replace(/\s+/g, " ")
        .trim()
    );
  }
}
