import { describe, it, expect, vi } from "vitest";
import { Agent } from "../src/agent.js";
import { generateText } from "@voltx/ai";

vi.mock("@voltx/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@voltx/ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

describe("Agent", () => {
  it("returns text response when no tool calls", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "Hello!",
      toolCalls: [],
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      finishReason: "stop",
      raw: {},
    });

    const agent = new Agent({
      name: "test",
      instructions: "Be helpful",
      model: "mock:model",
    });

    const result = await agent.run("Hi");
    expect(result.content).toBe("Hello!");
    expect(result.finishReason).toBe("complete");
    expect(result.steps).toHaveLength(1);
  });

  it("executes tools when requested", async () => {
    const toolFn = vi.fn().mockResolvedValue("42");

    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          { id: "tc-1", name: "calc", args: { expr: "40+2" } },
        ],
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: "tool_calls",
        raw: {},
      })
      .mockResolvedValueOnce({
        text: "The answer is 42",
        toolCalls: [],
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: "stop",
        raw: {},
      });

    const agent = new Agent({
      name: "test",
      instructions: "Be helpful",
      model: "mock:model",
      tools: [
        {
          name: "calc",
          description: "Calculate",
          execute: toolFn,
        },
      ],
    });

    const result = await agent.run("What is 40+2?");
    expect(toolFn).toHaveBeenCalledWith({ expr: "40+2" });
    expect(result.content).toBe("The answer is 42");
    expect(result.steps).toHaveLength(3); // llm_call → tool_call → llm_call
  });

  it("reports error for missing tool", async () => {
    vi.mocked(generateText).mockResolvedValueOnce({
      text: "",
      toolCalls: [
        { id: "tc-1", name: "missing", args: {} },
      ],
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
      finishReason: "tool_calls",
      raw: {},
    });

    const agent = new Agent({
      name: "test",
      instructions: "Be helpful",
      model: "mock:model",
    });

    const result = await agent.run("Test");
    const toolStep = result.steps.find((s) => s.type === "tool_call");
    expect(toolStep?.toolExecution?.error).toContain('Tool "missing" not found');
  });

  it("stops at max iterations", async () => {
    // Always return tool_calls so it would loop forever
    vi.mocked(generateText).mockResolvedValue({
      text: "",
      toolCalls: [
        { id: "tc-1", name: "noop", args: {} },
      ],
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      finishReason: "tool_calls",
      raw: {},
    });

    const agent = new Agent({
      name: "test",
      instructions: "Be helpful",
      model: "mock:model",
      maxIterations: 2,
      tools: [
        { name: "noop", description: "No op", execute: async () => "ok" },
      ],
    });

    const result = await agent.run("Loop");
    expect(result.finishReason).toBe("max_iterations");
  });

  it("accumulates token usage across steps", async () => {
    vi.mocked(generateText)
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [{ id: "tc-1", name: "noop", args: {} }],
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        finishReason: "tool_calls",
        raw: {},
      })
      .mockResolvedValueOnce({
        text: "Done",
        toolCalls: [],
        usage: { promptTokens: 8, completionTokens: 2, totalTokens: 10 },
        finishReason: "stop",
        raw: {},
      });

    const agent = new Agent({
      name: "test",
      instructions: "Be helpful",
      model: "mock:model",
      tools: [{ name: "noop", description: "No op", execute: async () => "ok" }],
    });

    const result = await agent.run("Test");
    expect(result.usage.promptTokens).toBe(13);
    expect(result.usage.completionTokens).toBe(7);
    expect(result.usage.totalTokens).toBe(20);
  });
});
