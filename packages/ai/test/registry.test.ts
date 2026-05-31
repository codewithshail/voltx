import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  resolveModel,
  resolveApiKey,
  getProvider,
  registerProvider,
} from "../src/providers/registry.js";

describe("registry", () => {
  beforeEach(() => {
    // Register a mock provider for testing
    registerProvider("mock", () => ({
      name: "mock",
      chat: async () => ({
        text: "hello",
        toolCalls: [],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        finishReason: "stop" as const,
        raw: {},
      }),
      stream: async () => ({ stream: (async function* () {})() }),
    }));
  });

  describe("resolveModel", () => {
    it("defaults to openai when no provider prefix", () => {
      const ref = resolveModel("gpt-4o");
      expect(ref.provider).toBe("openai");
      expect(ref.model).toBe("gpt-4o");
    });

    it("parses provider:model strings", () => {
      const ref = resolveModel("cerebras:llama3.1-8b");
      expect(ref.provider).toBe("cerebras");
      expect(ref.model).toBe("llama3.1-8b");
    });

    it("passes through ModelRef objects", () => {
      const input = { provider: "anthropic", model: "claude-3", config: { apiKey: "sk" } };
      const ref = resolveModel(input);
      expect(ref).toBe(input);
    });
  });

  describe("resolveApiKey", () => {
    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.CEREBRAS_API_KEY;
    });

    it("returns explicit key if provided", () => {
      expect(resolveApiKey("openai", "explicit")).toBe("explicit");
    });

    it("reads from environment variable", () => {
      process.env.CEREBRAS_API_KEY = "env-key";
      expect(resolveApiKey("cerebras")).toBe("env-key");
    });

    it("returns undefined for unknown provider", () => {
      expect(resolveApiKey("unknown")).toBeUndefined();
    });

    it("returns undefined for ollama (no key needed)", () => {
      expect(resolveApiKey("ollama")).toBeUndefined();
    });
  });

  describe("getProvider", () => {
    it("returns provider for registered name", () => {
      const provider = getProvider("mock");
      expect(provider.name).toBe("mock");
      expect(typeof provider.chat).toBe("function");
      expect(typeof provider.stream).toBe("function");
    });

    it("throws for unknown provider", () => {
      expect(() => getProvider("nonexistent")).toThrow("[voltx/ai] Unknown provider");
    });
  });
});
