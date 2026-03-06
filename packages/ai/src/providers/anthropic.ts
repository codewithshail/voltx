// @voltx/ai — Anthropic provider
// Anthropic uses a different API format than OpenAI, so we implement it directly.

import type {
  AIProvider,
  ProviderConfig,
  ProviderChatOptions,
  ProviderChatResponse,
  ProviderStreamResponse,
  StreamChunk,
  ToolCallResult,
  FinishReason,
} from "../types.js";
import { resolveApiKey } from "./registry.js";

export function createAnthropicProvider(config: ProviderConfig = {}): AIProvider {
  const apiKey = config.apiKey ?? resolveApiKey("anthropic");
  const baseUrl = (config.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");

  function buildHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey ?? "",
      "anthropic-version": "2023-06-01",
      ...config.headers,
    };
  }

  /** Convert OpenAI-style messages to Anthropic format */
  function convertMessages(messages: ProviderChatOptions["messages"]): {
    system?: string;
    messages: Array<{ role: "user" | "assistant"; content: unknown }>;
  } {
    let system: string | undefined;
    const converted: Array<{ role: "user" | "assistant"; content: unknown }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        // Concatenate multiple system messages
        system = system ? `${system}\n\n${msg.content ?? ""}` : (msg.content ?? "");
        continue;
      }
      if (msg.role === "tool") {
        // Anthropic expects tool results as user messages with tool_result content blocks
        converted.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: msg.tool_call_id,
            content: msg.content ?? "",
          }],
        });
        continue;
      }
      if (msg.role === "assistant" && msg.tool_calls && msg.tool_calls.length > 0) {
        // Assistant message with tool calls
        const content: unknown[] = [];
        if (msg.content) content.push({ type: "text", text: msg.content });
        for (const tc of msg.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
        converted.push({ role: "assistant", content });
        continue;
      }
      converted.push({
        role: msg.role as "user" | "assistant",
        content: msg.content ?? "",
      });
    }

    return { system, messages: converted };
  }

  function convertTools(tools?: ProviderChatOptions["tools"]): unknown[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  function mapStopReason(reason: string | null | undefined): FinishReason {
    switch (reason) {
      case "end_turn": return "stop";
      case "max_tokens": return "length";
      case "tool_use": return "tool_calls";
      default: return "unknown";
    }
  }

  return {
    name: "anthropic",

    async chat(options: ProviderChatOptions): Promise<ProviderChatResponse> {
      const { system, messages } = convertMessages(options.messages);
      const body: Record<string, unknown> = {
        model: options.model,
        messages,
        max_tokens: options.maxTokens ?? 4096,
      };
      if (system) body.system = system;
      if (options.temperature !== undefined) body.temperature = options.temperature;
      if (options.topP !== undefined) body.top_p = options.topP;
      if (options.stop) body.stop_sequences = options.stop;
      const tools = convertTools(options.tools);
      if (tools) body.tools = tools;

      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(body),
        signal: options.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "Unknown error");
        throw new Error(`[voltx/ai] Anthropic API error (${res.status}): ${errorBody}`);
      }

      const data = await res.json() as Record<string, unknown>;
      const content = data.content as Array<Record<string, unknown>>;
      const usage = data.usage as Record<string, number> ?? {};

      let text = "";
      const toolCalls: ToolCallResult[] = [];

      for (const block of content) {
        if (block.type === "text") {
          text += block.text as string;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id as string,
            type: "function",
            function: {
              name: block.name as string,
              arguments: JSON.stringify(block.input),
            },
          });
        }
      }

      return {
        text: text || null,
        toolCalls,
        usage: {
          promptTokens: usage.input_tokens ?? 0,
          completionTokens: usage.output_tokens ?? 0,
          totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
        },
        finishReason: mapStopReason(data.stop_reason as string),
        raw: data,
      };
    },

    async stream(options: ProviderChatOptions): Promise<ProviderStreamResponse> {
      const { system, messages } = convertMessages(options.messages);
      const body: Record<string, unknown> = {
        model: options.model,
        messages,
        max_tokens: options.maxTokens ?? 4096,
        stream: true,
      };
      if (system) body.system = system;
      if (options.temperature !== undefined) body.temperature = options.temperature;
      if (options.topP !== undefined) body.top_p = options.topP;
      if (options.stop) body.stop_sequences = options.stop;
      const tools = convertTools(options.tools);
      if (tools) body.tools = tools;

      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(body),
        signal: options.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "Unknown error");
        throw new Error(`[voltx/ai] Anthropic streaming error (${res.status}): ${errorBody}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      async function* parseStream(): AsyncIterable<StreamChunk> {
        let buffer = "";
        // Track current tool_use block being streamed
        let currentToolId = "";
        let currentToolName = "";
        let currentToolArgs = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;
              const payload = trimmed.slice(6);

              try {
                const event = JSON.parse(payload) as Record<string, unknown>;
                const type = event.type as string;

                if (type === "content_block_start") {
                  // Track tool_use blocks as they start
                  const contentBlock = event.content_block as Record<string, unknown>;
                  if (contentBlock?.type === "tool_use") {
                    currentToolId = contentBlock.id as string;
                    currentToolName = contentBlock.name as string;
                    currentToolArgs = "";
                  }
                } else if (type === "content_block_delta") {
                  const delta = event.delta as Record<string, unknown>;
                  if (delta.type === "text_delta") {
                    yield { type: "text-delta", textDelta: delta.text as string };
                  } else if (delta.type === "input_json_delta") {
                    // Accumulate tool call arguments
                    currentToolArgs += (delta.partial_json as string) ?? "";
                  }
                } else if (type === "content_block_stop") {
                  // Emit completed tool call
                  if (currentToolId) {
                    yield {
                      type: "tool-call-delta",
                      toolCallDelta: {
                        id: currentToolId,
                        type: "function",
                        function: { name: currentToolName, arguments: currentToolArgs },
                      },
                    };
                    currentToolId = "";
                    currentToolName = "";
                    currentToolArgs = "";
                  }
                } else if (type === "message_delta") {
                  const delta = event.delta as Record<string, unknown>;
                  const usage = event.usage as Record<string, number> | undefined;
                  yield {
                    type: "finish",
                    finishReason: mapStopReason(delta.stop_reason as string),
                    usage: usage ? {
                      promptTokens: usage.input_tokens ?? 0,
                      completionTokens: usage.output_tokens ?? 0,
                      totalTokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
                    } : undefined,
                  };
                }
              } catch {
                // Skip malformed lines
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      return { stream: parseStream() };
    },

    // Anthropic does not support embeddings
  };
}

/** Shorthand: anthropic("claude-sonnet-4") returns a ModelRef */
export function anthropic(model: string) {
  return { provider: "anthropic", model, config: {} };
}