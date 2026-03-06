// @voltx/ai — generateObject() — Structured output with Zod schema

import type { ZodType } from "zod";
import type { GenerateObjectOptions, GenerateObjectResult } from "./types.js";
import { resolveModel, getProvider, resolveApiKey } from "./providers/registry.js";
import { toProviderMessages, zodToJsonSchema } from "./utils.js";

/**
 * Generate a structured JSON object from an LLM, validated against a Zod schema.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 *
 * const result = await generateObject({
 *   model: "openai:gpt-4o",
 *   prompt: "Generate a user profile",
 *   schema: z.object({
 *     name: z.string(),
 *     age: z.number(),
 *     interests: z.array(z.string()),
 *   }),
 * });
 * console.log(result.object); // { name: "...", age: 25, interests: [...] }
 * ```
 */
export async function generateObject<T>(
  options: GenerateObjectOptions<T>
): Promise<GenerateObjectResult<T>> {
  const ref = resolveModel(options.model);
  const apiKey = resolveApiKey(ref.provider, ref.config.apiKey);
  const provider = getProvider(ref.provider, { ...ref.config, apiKey });

  const messages = toProviderMessages(options.messages, options.system, options.prompt);
  const jsonSchema = zodToJsonSchema(options.schema as ZodType);

  // Add instruction to return JSON
  const systemMsg = messages.find((m) => m.role === "system");
  const jsonInstruction = `\n\nRespond with a valid JSON object matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;

  if (systemMsg) {
    systemMsg.content = (systemMsg.content ?? "") + jsonInstruction;
  } else {
    messages.unshift({ role: "system", content: jsonInstruction });
  }

  // Use native JSON mode if provider supports it, otherwise rely on prompt instruction
  const responseFormat = (ref.provider === "anthropic" || ref.provider === "ollama")
    ? undefined
    : {
        type: "json_schema" as const,
        json_schema: {
          name: options.schemaName ?? "response",
          strict: true,
          schema: jsonSchema,
        },
      };

  const response = await provider.chat({
    model: ref.model,
    messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    responseFormat,
    signal: options.signal,
  });

  const text = response.text ?? "";

  // Parse JSON from response
  let parsed: unknown;
  try {
    // Try to extract JSON from the response (handles markdown code blocks too)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text];
    parsed = JSON.parse(jsonMatch[1]!.trim());
  } catch {
    throw new Error(
      `[voltx/ai] Failed to parse JSON from model response. Raw text: ${text.slice(0, 200)}`
    );
  }

  // Validate with Zod
  const validated = (options.schema as ZodType).safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `[voltx/ai] Schema validation failed: ${validated.error.message}`
    );
  }

  return {
    object: validated.data as T,
    usage: response.usage,
    raw: response.raw,
  };
}