import { describe, it, expect } from "vitest";
import { filePathToUrlPath } from "../src/router.js";

describe("router", () => {
  describe("filePathToUrlPath", () => {
    it("converts index.ts to root path", () => {
      expect(filePathToUrlPath("/project/api/index.ts", "/project/api")).toBe("/api");
    });

    it("converts simple route", () => {
      expect(filePathToUrlPath("/project/api/users.ts", "/project/api")).toBe("/api/users");
    });

    it("converts dynamic route [param]", () => {
      expect(filePathToUrlPath("/project/api/users/[id].ts", "/project/api")).toBe("/api/users/:id");
    });

    it("converts catch-all route", () => {
      expect(filePathToUrlPath("/project/api/[...slug].ts", "/project/api")).toBe("/api/*");
    });

    it("converts nested index", () => {
      expect(filePathToUrlPath("/project/api/blog/index.ts", "/project/api")).toBe("/api/blog");
    });

    it("converts nested dynamic", () => {
      expect(filePathToUrlPath("/project/api/blog/[slug].ts", "/project/api")).toBe("/api/blog/:slug");
    });

    it("handles .js extension", () => {
      expect(filePathToUrlPath("/project/api/hello.js", "/project/api")).toBe("/api/hello");
    });
  });
});
