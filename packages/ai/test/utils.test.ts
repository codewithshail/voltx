import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toProviderMessages, toProviderTools, zodToJsonSchema } from "../src/utils.js";

describe("utils", () => {
  describe("toProviderMessages", () => {
    it("includes system message first", () => {
      const result = toProviderMessages([], "You are helpful", undefined);
      expect(result[0]).toEqual({ role: "system", content: "You are helpful" });
    });

    it("includes prompt as user message", () => {
      const result = toProviderMessages([], undefined, "Hello");
      expect(result[0]).toEqual({ role: "user", content: "Hello" });
    });

    it("preserves message history", () => {
      const result = toProviderMessages(
        [{ role: "user", content: "Q1" }, { role: "assistant", content: "A1" }],
        "Sys",
        "Q2"
      );
      expect(result).toHaveLength(4);
      expect(result[0].role).toBe("system");
      expect(result[1].role).toBe("user");
      expect(result[2].role).toBe("assistant");
      expect(result[3].role).toBe("user");
    });

    it("flattens text-only content arrays to strings", () => {
      const result = toProviderMessages(
        [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
        undefined,
        undefined
      );
      expect(result[0].content).toBe("Hello");
    });
  });

  describe("toProviderTools", () => {
    it("returns undefined for empty tools", () => {
      expect(toProviderTools(undefined)).toBeUndefined();
      expect(toProviderTools({})).toBeUndefined();
    });

    it("converts tool definitions to provider format", () => {
      const tools = {
        calc: { name: "calc", description: "Calculate", parameters: { type: "object" } },
      };
      const result = toProviderTools(tools);
      expect(result).toHaveLength(1);
      expect(result![0].type).toBe("function");
      expect(result![0].function.name).toBe("calc");
    });
  });

  describe("zodToJsonSchema", () => {
    it("converts ZodObject", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const json = zodToJsonSchema(schema);
      expect(json.type).toBe("object");
      expect(json.properties).toHaveProperty("name");
      expect(json.properties).toHaveProperty("age");
    });

    it("converts ZodString", () => {
      const json = zodToJsonSchema(z.string());
      expect(json.type).toBe("string");
    });

    it("converts ZodNumber", () => {
      const json = zodToJsonSchema(z.number());
      expect(json.type).toBe("number");
    });

    it("converts ZodBoolean", () => {
      const json = zodToJsonSchema(z.boolean());
      expect(json.type).toBe("boolean");
    });

    it("converts ZodArray", () => {
      const json = zodToJsonSchema(z.array(z.string()));
      expect(json.type).toBe("array");
      expect(json.items).toEqual({ type: "string" });
    });

    it("converts ZodEnum", () => {
      const json = zodToJsonSchema(z.enum(["a", "b"]));
      expect(json.type).toBe("string");
      expect(json.enum).toEqual(["a", "b"]);
    });

    it("unwraps ZodOptional", () => {
      const json = zodToJsonSchema(z.string().optional());
      expect(json.type).toBe("string");
    });
  });
});
