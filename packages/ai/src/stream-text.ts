// @voltx/ai — streamText()

import type {
  StreamTextOptions,
  StreamTextResult,
  TokenUsage,
} from "./types.js";
import { resolveModel, getProvider, resolveApiKey } from "./providers/registry.js";
import { toProviderMessages, toProviderTools } from "./utils.js";

/**
 * Stream text from an LLM using Server-Sent Events.
 *
 * @example
 * ```ts
 * const result = await streamText({
 *   model: "cerebras:llama3.1-8b",
 *   prompt: "Write a poem about TypeScript",
 * });
 *
 * for await (const chunk of result.textStream) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export async function streamText(options: StreamTextOptions): Promise<StreamTextResult> {
  const ref = resolveModel(options.model);
  const apiKey = resolveApiKey(ref.provider, ref.config.apiKey);
  const provider = getProvider(ref.provider, { ...ref.config, apiKey });

  const messages = toProviderMessages(options.messages, options.system, options.prompt);
  const tools = toProviderTools(options.tools);

  const abortController = new AbortController();
  const signal = options.signal ?? abortController.signal;

  const response = await provider.stream({
    model: ref.model,
    messages,
    tools,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
    stop: options.stop,
    signal,
  });

  let fullText = "";
  let finalUsage: TokenUsage | null = null;
  let consumed = false;

  let resolveText: (text: string) => void;
  let resolveUsage: (usage: TokenUsage) => void;

  const textPromise = new Promise<string>((resolve) => { resolveText = resolve; });
  const usagePromise = new Promise<TokenUsage>((resolve) => { resolveUsage = resolve; });

  // Tee the provider stream so multiple consumers can read it.
  // The first consumer (textStream, toSSEResponse, or toReadableStream) drives
  // the underlying provider stream. Subsequent consumers read from the buffer.
  const buffer: string[] = [];

  async function* driveStream(): AsyncIterable<string> {
    if (consumed) {
      // Already driven — replay from buffer
      for (const chunk of buffer) yield chunk;
      return;
    }
    consumed = true;
    try {
      for await (const chunk of response.stream) {
        if (chunk.type === "text-delta" && chunk.textDelta) {
          fullText += chunk.textDelta;
          buffer.push(chunk.textDelta);
          yield chunk.textDelta;
        }
        if (chunk.type === "finish" && chunk.usage) {
          finalUsage = chunk.usage;
        }
      }
    } finally {
      resolveText!(fullText);
      resolveUsage!(finalUsage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 });
    }
  }

  return {
    textStream: driveStream(),
    text: textPromise,
    usage: usagePromise,

    abort() {
      abortController.abort();
    },

    toSSEResponse(): Response {
      const encoder = new TextEncoder();
      // Drive the stream in real-time — chunks go to client as they arrive
      const source = consumed ? buffer : null;

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            if (source) {
              // Stream already consumed — replay from buffer
              for (const chunk of source) {
                const data = JSON.stringify({ type: "text-delta", textDelta: chunk });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            } else {
              // Drive the stream in real-time
              for await (const chunk of driveStream()) {
                const data = JSON.stringify({ type: "text-delta", textDelta: chunk });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    },

    toReadableStream(): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      return new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of driveStream()) {
              controller.enqueue(encoder.encode(chunk));
            }
          } finally {
            controller.close();
          }
        },
      });
    },
  };
}