// @voltx/ai — generateText()

import type {
  GenerateTextOptions,
  GenerateTextResult,
  ParsedToolCall,
} from "./types.js";
import { resolveModel, getProvider, resolveApiKey } from "./providers/registry.js";
import { toProviderMessages, toProviderTools } from "./utils.js";

/**
 * Generate a complete text response from an LLM.
 *
 * @example
 * ```ts
 * const result = await generateText({
 *   model: "openai:gpt-4o",
 *   system: "You are a helpful assistant.",
 *   prompt: "What is TypeScript?",
 * });
 * console.log(result.text);
 * ```
 */
export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const ref = resolveModel(options.model);
  const apiKey = resolveApiKey(ref.provider, ref.config.apiKey);
  const provider = getProvider(ref.provider, { ...ref.config, apiKey });

  const messages = toProviderMessages(options.messages, options.system, options.prompt);
  const tools = toProviderTools(options.tools);

  const response = await provider.chat({
    model: ref.model,
    messages,
    tools,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
    stop: options.stop,
    signal: options.signal,
  });

  const toolCalls: ParsedToolCall[] = response.toolCalls.map((tc) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments);
    } catch {
      // Some models return malformed JSON — pass raw string as _raw
      args = { _raw: tc.function.arguments };
    }
    return {
      id: tc.id,
      name: tc.function.name,
      args,
    };
  });

  return {
    text: response.text ?? "",
    toolCalls,
    usage: response.usage,
    finishReason: response.finishReason,
    raw: response.raw,
  };
}