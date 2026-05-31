import { describe, it, expect } from "vitest";
import { CharacterSplitter, RecursiveTextSplitter, MarkdownSplitter } from "../src/splitters.js";

describe("splitters", () => {
  describe("CharacterSplitter", () => {
    it("splits text into chunks", () => {
      const splitter = new CharacterSplitter({ chunkSize: 20, overlap: 0 });
      const chunks = splitter.split("Hello world. This is a test. ");
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content.length).toBeLessThanOrEqual(20);
    });

    it("assigns sequential ids", () => {
      const splitter = new CharacterSplitter({ chunkSize: 10, overlap: 0 });
      const chunks = splitter.split("Hello world. Another sentence here.");
      expect(chunks[0].id).toBe("chunk-0");
      expect(chunks[1].id).toBe("chunk-1");
    });
  });

  describe("RecursiveTextSplitter", () => {
    it("splits on paragraph breaks first", () => {
      const splitter = new RecursiveTextSplitter({ chunkSize: 20, overlap: 0 });
      const text = "Paragraph one.\n\nParagraph two.\n\nParagraph three.";
      const chunks = splitter.split(text);
      expect(chunks.length).toBe(3);
    });

    it("recursively splits large paragraphs", () => {
      const splitter = new RecursiveTextSplitter({ chunkSize: 20, overlap: 0 });
      const text = "This is a very long sentence that should definitely be split into multiple pieces.";
      const chunks = splitter.split(text);
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe("MarkdownSplitter", () => {
    it("splits by headings", () => {
      const splitter = new MarkdownSplitter({ chunkSize: 1000, overlap: 0 });
      const text = "# Heading 1\n\nContent A.\n\n## Heading 2\n\nContent B.";
      const chunks = splitter.split(text);
      expect(chunks.length).toBe(2);
    });

    it("preserves header context in metadata", () => {
      const splitter = new MarkdownSplitter({ chunkSize: 1000, overlap: 0 });
      const text = "# Doc\n\n## Section\n\nBody text.";
      const chunks = splitter.split(text);
      expect(chunks[0].metadata.h1).toBe("Doc");
    });

    it("falls back to recursive splitting for large sections", () => {
      const splitter = new MarkdownSplitter({ chunkSize: 10, overlap: 0 });
      const text = "# Short\n\nThis is a really long paragraph that exceeds the tiny chunk size.";
      const chunks = splitter.split(text);
      expect(chunks.length).toBeGreaterThan(1);
    });
  });
});
