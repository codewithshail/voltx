import { describe, it, expect, vi, beforeAll } from "vitest";
import { generateText } from "../src/generate-text.js";
import { registerProvider } from "../src/providers/registry.js";

describe("generateText", () => {
  beforeAll(() => {
    registerProvider("mock", () => ({
      name: "mock",
      chat: async ({ model, messages }) => ({
        text: `Response from ${model} with ${messages.length} messages`,
        toolCalls: [],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "stop" as const,
        raw: {},
      }),
      stream: async () => ({ stream: (async function* () {})() }),
    }));
  });

  it("generates text using a provider", async () => {
    const result = await generateText({
      model: "mock:test-model",
      system: "You are helpful",
      prompt: "Hello",
    });

    expect(result.text).toContain("Response from test-model");
    expect(result.toolCalls).toEqual([]);
    expect(result.usage.totalTokens).toBe(15);
    expect(result.finishReason).toBe("stop");
  });

  it("parses tool call arguments as JSON", async () => {
    registerProvider("tool-mock", () => ({
      name: "tool-mock",
      chat: async () => ({
        text: "",
        toolCalls: [
          {
            id: "tc-1",
            type: "function" as const,
            function: { name: "calc", arguments: '{"x":1,"y":2}' },
          },
        ],
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: "tool_calls" as const,
        raw: {},
      }),
      stream: async () => ({ stream: (async function* () {})() }),
    }));

    const result = await generateText({
      model: "tool-mock:test",
      prompt: "Calculate",
    });

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("calc");
    expect(result.toolCalls[0].args).toEqual({ x: 1, y: 2 });
  });

  it("handles malformed JSON tool arguments gracefully", async () => {
    registerProvider("bad-json", () => ({
      name: "bad-json",
      chat: async () => ({
        text: "",
        toolCalls: [
          {
            id: "tc-1",
            type: "function" as const,
            function: { name: "calc", arguments: "not-json" },
          },
        ],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        finishReason: "tool_calls" as const,
        raw: {},
      }),
      stream: async () => ({ stream: (async function* () {})() }),
    }));

    const result = await generateText({
      model: "bad-json:test",
      prompt: "Test",
    });

    expect(result.toolCalls[0].args).toEqual({ _raw: "not-json" });
  });
});
