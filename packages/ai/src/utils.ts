// @voltx/ai — Shared utilities

import type { ZodType } from "zod";
import type {
  Message,
  ProviderMessage,
  ProviderTool,
  ToolDefinition,
} from "./types.js";

/** Convert user-facing Messages to provider-format messages */
export function toProviderMessages(
  messages: Message[] | undefined,
  system?: string,
  prompt?: string
): ProviderMessage[] {
  const result: ProviderMessage[] = [];

  if (system) {
    result.push({ role: "system", content: system });
  }

  if (messages) {
    for (const msg of messages) {
      // Preserve multimodal content arrays for providers that support them (OpenAI, Google)
      // For text-only messages, keep as string
      let content: string | null;
      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        // Check if it's all text — if so, flatten to string for broader compatibility
        const hasNonText = msg.content.some((p) => p.type !== "text");
        if (hasNonText) {
          // Keep as array for multimodal (images etc.) — cast to any for provider flexibility
          (result as unknown[]).push({
            role: msg.role,
            content: msg.content,
            tool_calls: msg.tool_calls,
            tool_call_id: msg.tool_call_id,
          });
          continue;
        }
        content = msg.content.map((p) => (p.type === "text" ? p.text : "")).join("");
      } else {
        content = null;
      }

      result.push({
        role: msg.role,
        content,
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id,
      });
    }
  }

  if (prompt) {
    result.push({ role: "user", content: prompt });
  }

  return result;
}

/** Convert tool definitions to provider format */
export function toProviderTools(
  tools?: Record<string, ToolDefinition>
): ProviderTool[] | undefined {
  if (!tools) return undefined;
  const entries = Object.entries(tools);
  if (entries.length === 0) return undefined;

  return entries.map(([key, tool]) => ({
    type: "function" as const,
    function: {
      name: tool.name ?? key,
      description: tool.description,
      parameters: isZodType(tool.parameters)
        ? zodToJsonSchema(tool.parameters)
        : (tool.parameters as Record<string, unknown>),
    },
  }));
}

/** Check if a value is a Zod schema */
function isZodType(value: unknown): value is ZodType {
  return (
    value !== null &&
    typeof value === "object" &&
    "_def" in (value as Record<string, unknown>)
  );
}

/** Minimal Zod-to-JSON-Schema converter for common types */
export function zodToJsonSchema(schema: ZodType): Record<string, unknown> {
  const def = (schema as unknown as { _def: Record<string, unknown> })._def;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodObject": {
      const shape = def.shape as () => Record<string, ZodType>;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape())) {
        properties[key] = zodToJsonSchema(value);
        const innerDef = (value as unknown as { _def: Record<string, unknown> })._def;
        if (innerDef.typeName !== "ZodOptional") {
          required.push(key);
        }
      }

      return {
        type: "object",
        properties,
        required: Object.keys(properties), // strict mode requires ALL properties in required
        additionalProperties: false,
      };
    }
    case "ZodString":
      return { type: "string", ...(def.description ? { description: def.description } : {}) };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray":
      return { type: "array", items: zodToJsonSchema(def.type as ZodType) };
    case "ZodEnum":
      return { type: "string", enum: def.values as string[] };
    case "ZodOptional":
      return zodToJsonSchema(def.innerType as ZodType);
    case "ZodDefault":
      return zodToJsonSchema(def.innerType as ZodType);
    default:
      return { type: "string" };
  }
}