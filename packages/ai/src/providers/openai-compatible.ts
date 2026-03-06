// @voltx/ai — OpenAI-compatible provider base
// Used by: OpenAI, Cerebras, OpenRouter, Ollama (all share the same API format)

import type {
  AIProvider,
  ProviderConfig,
  ProviderChatOptions,
  ProviderChatResponse,
  ProviderStreamResponse,
  ProviderEmbedOptions,
  ProviderEmbedResponse,
  StreamChunk,
  ToolCallResult,
  FinishReason,
  TokenUsage,
} from "../types.js";

interface OpenAICompatibleConfig extends ProviderConfig {
  name: string;
  defaultBaseUrl: string;
  supportsEmbeddings?: boolean;
  supportsStreamOptions?: boolean;
  supportsJsonSchema?: boolean;
}

export function createOpenAICompatibleProvider(cfg: OpenAICompatibleConfig): AIProvider {
  const baseUrl = (cfg.baseUrl ?? cfg.defaultBaseUrl).replace(/\/$/, "");

  function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...cfg.headers,
    };
    if (cfg.apiKey) {
      headers["Authorization"] = `Bearer ${cfg.apiKey}`;
    }
    return headers;
  }

  function buildBody(options: ProviderChatOptions, stream = false): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
      stream,
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.stop) body.stop = options.stop;
    if (options.tools && options.tools.length > 0) body.tools = options.tools;
    if (options.responseFormat && cfg.supportsJsonSchema !== false) {
      body.response_format = options.responseFormat;
    }
    if (stream && cfg.supportsStreamOptions !== false) {
      body.stream_options = { include_usage: true };
    }
    return body;
  }

  function mapFinishReason(reason: string | null | undefined): FinishReason {
    switch (reason) {
      case "stop": return "stop";
      case "length": return "length";
      case "tool_calls": return "tool_calls";
      case "content_filter": return "content_filter";
      default: return "unknown";
    }
  }

  const provider: AIProvider = {
    name: cfg.name,

    async chat(options: ProviderChatOptions): Promise<ProviderChatResponse> {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(buildBody(options, false)),
        signal: options.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "Unknown error");
        throw new Error(`[voltx/ai] ${cfg.name} API error (${res.status}): ${errorBody}`);
      }

      const data = await res.json() as Record<string, unknown>;
      const choices = data.choices as Array<Record<string, unknown>>;
      const choice = choices?.[0] ?? {};
      const message = choice.message as Record<string, unknown> ?? {};
      const usage = data.usage as Record<string, number> ?? {};

      return {
        text: (message.content as string) ?? null,
        toolCalls: (message.tool_calls as ToolCallResult[]) ?? [],
        usage: {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        },
        finishReason: mapFinishReason(choice.finish_reason as string),
        raw: data,
      };
    },

    async stream(options: ProviderChatOptions): Promise<ProviderStreamResponse> {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(buildBody(options, true)),
        signal: options.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "Unknown error");
        throw new Error(`[voltx/ai] ${cfg.name} streaming error (${res.status}): ${errorBody}`);
      }

      const body = res.body;
      if (!body) throw new Error(`[voltx/ai] ${cfg.name} returned no stream body`);

      async function* parseSSEStream(): AsyncIterable<StreamChunk> {
        const reader = body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        // Accumulate tool calls across chunks (OpenAI streams them incrementally)
        const toolCallAccumulator = new Map<number, { id: string; name: string; arguments: string }>();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const payload = trimmed.slice(6);
              if (payload === "[DONE]") return;

              try {
                const chunk = JSON.parse(payload) as Record<string, unknown>;
                const choices = chunk.choices as Array<Record<string, unknown>>;
                const delta = choices?.[0]?.delta as Record<string, unknown> | undefined;
                const finishReason = choices?.[0]?.finish_reason as string | null;

                if (delta?.content) {
                  yield { type: "text-delta", textDelta: delta.content as string };
                }

                // Accumulate streamed tool calls (id + name come first, arguments stream incrementally)
                if (delta?.tool_calls) {
                  const tcArray = delta.tool_calls as Array<Record<string, unknown>>;
                  for (const tc of tcArray) {
                    const index = (tc.index as number) ?? 0;
                    const fn = tc.function as Record<string, string> | undefined;
                    if (!toolCallAccumulator.has(index)) {
                      toolCallAccumulator.set(index, { id: (tc.id as string) ?? "", name: fn?.name ?? "", arguments: "" });
                    }
                    const acc = toolCallAccumulator.get(index)!;
                    if (tc.id) acc.id = tc.id as string;
                    if (fn?.name) acc.name = fn.name;
                    if (fn?.arguments) acc.arguments += fn.arguments;
                  }
                }

                // Usage comes in the final chunk with stream_options
                const usage = chunk.usage as Record<string, number> | undefined;

                if (finishReason) {
                  // Emit accumulated tool calls before finish
                  if (finishReason === "tool_calls") {
                    for (const [, tc] of toolCallAccumulator) {
                      yield {
                        type: "tool-call-delta",
                        toolCallDelta: {
                          id: tc.id,
                          type: "function",
                          function: { name: tc.name, arguments: tc.arguments },
                        },
                      };
                    }
                  }

                  yield {
                    type: "finish",
                    finishReason: mapFinishReason(finishReason),
                    usage: usage ? {
                      promptTokens: usage.prompt_tokens ?? 0,
                      completionTokens: usage.completion_tokens ?? 0,
                      totalTokens: usage.total_tokens ?? 0,
                    } : undefined,
                  };
                }
              } catch {
                // Skip malformed JSON lines
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      return { stream: parseSSEStream() };
    },
  };

  // Add embeddings support if the provider supports it
  if (cfg.supportsEmbeddings) {
    provider.embed = async (options: ProviderEmbedOptions): Promise<ProviderEmbedResponse> => {
      const input = Array.isArray(options.input) ? options.input : [options.input];

      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ model: options.model, input }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => "Unknown error");
        throw new Error(`[voltx/ai] ${cfg.name} embeddings error (${res.status}): ${errorBody}`);
      }

      const data = await res.json() as Record<string, unknown>;
      const embeddings = (data.data as Array<{ embedding: number[] }>).map((d) => d.embedding);
      const usage = data.usage as Record<string, number> ?? {};

      return {
        embeddings,
        usage: { tokens: usage.total_tokens ?? usage.prompt_tokens ?? 0 },
      };
    };
  }

  return provider;
}