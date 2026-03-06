// @voltx/ai — Core types

import type { ZodType } from "zod";

// ─── Messages ────────────────────────────────────────────────────────────────

export interface TextContent {
  type: "text";
  text: string;
}

export interface ImageContent {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
}

export type ContentPart = TextContent | ImageContent;

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCallResult[];
}

// ─── Tools ───────────────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ZodType | Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// ─── Provider ────────────────────────────────────────────────────────────────

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export interface ModelRef {
  provider: string;
  model: string;
  config: ProviderConfig;
}

// ─── Generate Text ───────────────────────────────────────────────────────────

export interface GenerateTextOptions {
  model: string | ModelRef;
  messages?: Message[];
  system?: string;
  prompt?: string;
  tools?: Record<string, ToolDefinition>;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface GenerateTextResult {
  text: string;
  toolCalls: ParsedToolCall[];
  usage: TokenUsage;
  finishReason: FinishReason;
  /** Raw response from the provider */
  raw: unknown;
}

// ─── Stream Text ─────────────────────────────────────────────────────────────

export interface StreamTextOptions extends GenerateTextOptions {}

export interface StreamTextResult {
  /** Async iterator of text chunks */
  textStream: AsyncIterable<string>;
  /** Full text (available after stream completes) */
  text: Promise<string>;
  /** Convert to SSE Response for HTTP endpoints */
  toSSEResponse(): Response;
  /** Convert to a ReadableStream of SSE events */
  toReadableStream(): ReadableStream<Uint8Array>;
  /** Usage info (available after stream completes) */
  usage: Promise<TokenUsage>;
  /** Abort the stream */
  abort(): void;
}

// ─── Generate Object (Structured Output) ─────────────────────────────────────

export interface GenerateObjectOptions<T = unknown> {
  model: string | ModelRef;
  messages?: Message[];
  system?: string;
  prompt?: string;
  schema: ZodType<T>;
  schemaName?: string;
  schemaDescription?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface GenerateObjectResult<T = unknown> {
  object: T;
  usage: TokenUsage;
  raw: unknown;
}

// ─── Embeddings ──────────────────────────────────────────────────────────────

export interface EmbedOptions {
  model: string | ModelRef;
  value: string;
}

export interface EmbedManyOptions {
  model: string | ModelRef;
  values: string[];
}

export interface EmbedResult {
  embedding: number[];
  usage: { tokens: number };
}

export interface EmbedManyResult {
  embeddings: number[][];
  usage: { tokens: number };
}

// ─── Shared ──────────────────────────────────────────────────────────────────

export interface ParsedToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type FinishReason = "stop" | "length" | "tool_calls" | "content_filter" | "error" | "unknown";

// ─── Provider Interface ──────────────────────────────────────────────────────

export interface AIProvider {
  name: string;
  chat(options: ProviderChatOptions): Promise<ProviderChatResponse>;
  stream(options: ProviderChatOptions): Promise<ProviderStreamResponse>;
  embed?(options: ProviderEmbedOptions): Promise<ProviderEmbedResponse>;
}

export interface ProviderChatOptions {
  model: string;
  messages: ProviderMessage[];
  tools?: ProviderTool[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  responseFormat?: { type: "json_object" | "json_schema"; json_schema?: unknown };
  signal?: AbortSignal;
}

export interface ProviderMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCallResult[];
  tool_call_id?: string;
}

export interface ProviderTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ProviderChatResponse {
  text: string | null;
  toolCalls: ToolCallResult[];
  usage: TokenUsage;
  finishReason: FinishReason;
  raw: unknown;
}

export interface ProviderStreamResponse {
  stream: AsyncIterable<StreamChunk>;
  raw?: unknown;
}

export interface StreamChunk {
  type: "text-delta" | "tool-call-delta" | "finish" | "error";
  textDelta?: string;
  toolCallDelta?: Partial<ToolCallResult>;
  finishReason?: FinishReason;
  usage?: TokenUsage;
  error?: string;
}

export interface ProviderEmbedOptions {
  model: string;
  input: string | string[];
}

export interface ProviderEmbedResponse {
  embeddings: number[][];
  usage: { tokens: number };
}