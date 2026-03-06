// @voltx/memory — Core types

// ─── Message ─────────────────────────────────────────────────────────────────

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Unix timestamp (ms) — auto-set if not provided */
  timestamp?: number;
  /** Arbitrary metadata (tool call IDs, sources, etc.) */
  metadata?: Record<string, unknown>;
}

// ─── Conversation ────────────────────────────────────────────────────────────

export interface ConversationInfo {
  id: string;
  /** Number of messages in the conversation */
  messageCount: number;
  /** When the conversation was created (first message timestamp) */
  createdAt: number;
  /** When the last message was added */
  updatedAt: number;
  /** Optional metadata (title, tags, user ID, etc.) */
  metadata?: Record<string, unknown>;
}

// ─── Memory Store Interface ──────────────────────────────────────────────────

export interface MemoryStore {
  name: string;

  /** Add a message to a conversation */
  add(conversationId: string, message: Message): Promise<void>;

  /** Get messages for a conversation, optionally limited to the last N */
  get(conversationId: string, limit?: number): Promise<Message[]>;

  /**
   * Get messages within a token budget.
   * System messages are always preserved.
   * Returns the most recent messages that fit within `maxTokens`.
   */
  getWithTokenLimit(conversationId: string, maxTokens: number): Promise<Message[]>;

  /** Clear all messages in a conversation */
  clear(conversationId: string): Promise<void>;

  /** Delete an entire conversation and its messages */
  delete(conversationId: string): Promise<void>;

  /** Get info about a conversation */
  getConversationInfo(conversationId: string): Promise<ConversationInfo | null>;

  /** List all conversation IDs */
  listConversations(): Promise<string[]>;

  /** Check if a conversation exists */
  has(conversationId: string): Promise<boolean>;
}

// ─── Config ──────────────────────────────────────────────────────────────────

export interface MemoryConfig {
  /** Max messages to keep per conversation (default: 100) */
  maxMessages?: number;
  /**
   * Approximate chars-per-token ratio for token estimation.
   * Default: 4 (roughly 1 token ≈ 4 chars for English text).
   * Used by getWithTokenLimit().
   */
  charsPerToken?: number;
}

export interface PostgresMemoryConfig extends MemoryConfig {
  /** Postgres connection string (Neon or local). Falls back to DATABASE_URL env. */
  url?: string;
  /** Table name for messages (default: "voltx_memory_messages") */
  tableName?: string;
  /** Table name for conversations (default: "voltx_memory_conversations") */
  conversationTable?: string;
}
