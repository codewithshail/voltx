// @voltx/memory — In-memory store (dev / testing)

import type { MemoryStore, Message, ConversationInfo, MemoryConfig } from "./types.js";

export class InMemoryStore implements MemoryStore {
  name = "in-memory";
  private store = new Map<string, Message[]>();
  private metadata = new Map<string, Record<string, unknown>>();
  private maxMessages: number;
  private charsPerToken: number;

  constructor(config?: MemoryConfig) {
    this.maxMessages = config?.maxMessages ?? 100;
    this.charsPerToken = config?.charsPerToken ?? 4;
  }

  async add(conversationId: string, message: Message): Promise<void> {
    const messages = this.store.get(conversationId) ?? [];
    messages.push({ ...message, timestamp: message.timestamp ?? Date.now() });

    // Trim if over limit — preserve system messages
    if (messages.length > this.maxMessages) {
      const system = messages.filter((m) => m.role === "system");
      const nonSystem = messages.filter((m) => m.role !== "system");
      const keep = this.maxMessages - system.length;
      const trimmed = [...system, ...nonSystem.slice(-Math.max(keep, 0))];
      this.store.set(conversationId, trimmed);
    } else {
      this.store.set(conversationId, messages);
    }
  }

  async get(conversationId: string, limit?: number): Promise<Message[]> {
    const messages = this.store.get(conversationId) ?? [];
    if (!limit) return [...messages];

    // Always include system messages + last N non-system messages
    const system = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");
    return [...system, ...nonSystem.slice(-limit)];
  }

  async getWithTokenLimit(conversationId: string, maxTokens: number): Promise<Message[]> {
    const messages = this.store.get(conversationId) ?? [];
    if (messages.length === 0) return [];

    // Always include system messages first
    const system = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    let tokenBudget = maxTokens;

    // Deduct system message tokens
    for (const msg of system) {
      tokenBudget -= this.estimateTokens(msg.content);
    }

    if (tokenBudget <= 0) {
      // System messages alone exceed the budget — return them anyway
      return [...system];
    }

    // Walk backwards through non-system messages, adding until budget is exhausted
    const selected: Message[] = [];
    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const tokens = this.estimateTokens(nonSystem[i].content);
      if (tokenBudget - tokens < 0) break;
      tokenBudget -= tokens;
      selected.unshift(nonSystem[i]);
    }

    return [...system, ...selected];
  }

  async clear(conversationId: string): Promise<void> {
    this.store.set(conversationId, []);
  }

  async delete(conversationId: string): Promise<void> {
    this.store.delete(conversationId);
    this.metadata.delete(conversationId);
  }

  async getConversationInfo(conversationId: string): Promise<ConversationInfo | null> {
    const messages = this.store.get(conversationId);
    if (!messages || messages.length === 0) return null;

    return {
      id: conversationId,
      messageCount: messages.length,
      createdAt: messages[0].timestamp ?? 0,
      updatedAt: messages[messages.length - 1].timestamp ?? 0,
      metadata: this.metadata.get(conversationId),
    };
  }

  async listConversations(): Promise<string[]> {
    return Array.from(this.store.keys());
  }

  async has(conversationId: string): Promise<boolean> {
    return this.store.has(conversationId);
  }

  /** Set metadata on a conversation */
  setMetadata(conversationId: string, meta: Record<string, unknown>): void {
    this.metadata.set(conversationId, meta);
  }

  /** Get the total number of messages across all conversations */
  totalMessages(): number {
    let total = 0;
    for (const msgs of this.store.values()) total += msgs.length;
    return total;
  }

  /** Estimate token count from text (rough: chars / charsPerToken) */
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / this.charsPerToken);
  }
}
