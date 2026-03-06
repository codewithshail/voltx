// @voltx/memory — Postgres-backed memory store (production)
//
// Uses the Neon serverless driver directly (same pattern as @voltx/db pgvector adapter).
// Stores conversations and messages in `voltx_conversations` + `voltx_memory_messages` tables.
//
// Usage:
//   import { createMemory } from "@voltx/memory";
//   const memory = createMemory("postgres", { url: process.env.DATABASE_URL! });
//   await memory.add("conv-1", { role: "user", content: "Hello" });

import { neon } from "@neondatabase/serverless";
import type { MemoryStore, Message, ConversationInfo, PostgresMemoryConfig } from "./types.js";

/**
 * Neon's `neon()` returns a callable with `.query()` and `.transaction()` methods.
 * We define a minimal interface here to avoid TS language server resolution quirks
 * with the callable + methods pattern on NeonQueryFunction.
 */
interface NeonSQL {
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
}

export class PostgresStore implements MemoryStore {
  name = "postgres";
  private sql: NeonSQL;
  private maxMessages: number;
  private charsPerToken: number;
  private tableName: string;
  private conversationTable: string;
  private initialized = false;

  constructor(config: PostgresMemoryConfig) {
    const url = config.url ?? process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "[voltx/memory] Database URL required for Postgres memory. Set DATABASE_URL env or pass url.",
      );
    }

    this.sql = neon(url) as unknown as NeonSQL;
    this.maxMessages = config.maxMessages ?? 100;
    this.charsPerToken = config.charsPerToken ?? 4;
    this.tableName = config.tableName ?? "voltx_memory_messages";
    this.conversationTable = config.conversationTable ?? "voltx_memory_conversations";
  }

  /** Create tables if they don't exist */
  private async ensureTables(): Promise<void> {
    if (this.initialized) return;

    // Conversation metadata table
    await this.sql.query(
      `CREATE TABLE IF NOT EXISTS ${this.conversationTable} (
        id TEXT PRIMARY KEY,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    );

    // Messages table with index on conversation_id + created_at
    await this.sql.query(
      `CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id SERIAL PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES ${this.conversationTable}(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    );

    await this.sql.query(
      `CREATE INDEX IF NOT EXISTS idx_${this.tableName}_conv
       ON ${this.tableName} (conversation_id, created_at)`,
    );

    this.initialized = true;
  }

  /** Ensure a conversation row exists (upsert) */
  private async ensureConversation(conversationId: string): Promise<void> {
    await this.sql.query(
      `INSERT INTO ${this.conversationTable} (id)
       VALUES ($1)
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
      [conversationId],
    );
  }

  async add(conversationId: string, message: Message): Promise<void> {
    await this.ensureTables();
    await this.ensureConversation(conversationId);

    const metadataJson = JSON.stringify(message.metadata ?? {});
    const ts = message.timestamp
      ? new Date(message.timestamp).toISOString()
      : new Date().toISOString();

    await this.sql.query(
      `INSERT INTO ${this.tableName} (conversation_id, role, content, metadata, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz)`,
      [conversationId, message.role, message.content, metadataJson, ts],
    );

    // Update conversation timestamp
    await this.sql.query(
      `UPDATE ${this.conversationTable} SET updated_at = NOW() WHERE id = $1`,
      [conversationId],
    );

    // Trim if over limit — preserve system messages
    await this.trimMessages(conversationId);
  }

  /** Trim non-system messages if total exceeds maxMessages */
  private async trimMessages(conversationId: string): Promise<void> {
    // Count total messages
    const countResult = await this.sql.query(
      `SELECT COUNT(*)::int AS total FROM ${this.tableName} WHERE conversation_id = $1`,
      [conversationId],
    ) as Array<{ total: number }>;

    const total = countResult[0]?.total ?? 0;
    if (total <= this.maxMessages) return;

    // Count system messages (always preserved)
    const sysResult = await this.sql.query(
      `SELECT COUNT(*)::int AS sys_count FROM ${this.tableName}
       WHERE conversation_id = $1 AND role = 'system'`,
      [conversationId],
    ) as Array<{ sys_count: number }>;

    const sysCount = sysResult[0]?.sys_count ?? 0;
    const nonSysToKeep = Math.max(this.maxMessages - sysCount, 0);

    // Count how many non-system messages exist
    const nonSysTotal = total - sysCount;
    const toDelete = nonSysTotal - nonSysToKeep;
    if (toDelete <= 0) return;

    // Delete the oldest non-system messages beyond the keep limit
    await this.sql.query(
      `DELETE FROM ${this.tableName}
       WHERE id IN (
         SELECT id FROM ${this.tableName}
         WHERE conversation_id = $1 AND role != 'system'
         ORDER BY created_at ASC
         LIMIT $2
       )`,
      [conversationId, toDelete],
    );
  }

  async get(conversationId: string, limit?: number): Promise<Message[]> {
    await this.ensureTables();

    if (!limit) {
      // Return all messages in order
      const rows = await this.sql.query(
        `SELECT role, content, metadata, created_at FROM ${this.tableName}
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversationId],
      ) as MessageRow[];

      return rows.map(rowToMessage);
    }

    // System messages + last N non-system messages (same logic as InMemoryStore)
    const systemRows = await this.sql.query(
      `SELECT role, content, metadata, created_at FROM ${this.tableName}
       WHERE conversation_id = $1 AND role = 'system'
       ORDER BY created_at ASC`,
      [conversationId],
    ) as MessageRow[];

    const nonSystemRows = await this.sql.query(
      `SELECT role, content, metadata, created_at FROM ${this.tableName}
       WHERE conversation_id = $1 AND role != 'system'
       ORDER BY created_at DESC
       LIMIT $2`,
      [conversationId, limit],
    ) as MessageRow[];

    // Reverse non-system to chronological order
    nonSystemRows.reverse();

    return [...systemRows.map(rowToMessage), ...nonSystemRows.map(rowToMessage)];
  }

  async getWithTokenLimit(conversationId: string, maxTokens: number): Promise<Message[]> {
    await this.ensureTables();

    // Get system messages first
    const systemRows = await this.sql.query(
      `SELECT role, content, metadata, created_at FROM ${this.tableName}
       WHERE conversation_id = $1 AND role = 'system'
       ORDER BY created_at ASC`,
      [conversationId],
    ) as MessageRow[];

    const systemMessages = systemRows.map(rowToMessage);

    // Calculate remaining token budget after system messages
    let tokenBudget = maxTokens;
    for (const msg of systemMessages) {
      tokenBudget -= this.estimateTokens(msg.content);
    }

    if (tokenBudget <= 0) {
      return systemMessages;
    }

    // Fetch non-system messages newest-first, accumulate until budget exhausted
    const nonSystemRows = await this.sql.query(
      `SELECT role, content, metadata, created_at FROM ${this.tableName}
       WHERE conversation_id = $1 AND role != 'system'
       ORDER BY created_at DESC`,
      [conversationId],
    ) as MessageRow[];

    const selected: Message[] = [];
    for (const row of nonSystemRows) {
      const tokens = this.estimateTokens(row.content);
      if (tokenBudget - tokens < 0) break;
      tokenBudget -= tokens;
      selected.unshift(rowToMessage(row));
    }

    return [...systemMessages, ...selected];
  }

  async clear(conversationId: string): Promise<void> {
    await this.ensureTables();
    await this.sql.query(
      `DELETE FROM ${this.tableName} WHERE conversation_id = $1`,
      [conversationId],
    );
  }

  async delete(conversationId: string): Promise<void> {
    await this.ensureTables();
    // Messages cascade-delete via FK
    await this.sql.query(
      `DELETE FROM ${this.conversationTable} WHERE id = $1`,
      [conversationId],
    );
  }

  async getConversationInfo(conversationId: string): Promise<ConversationInfo | null> {
    await this.ensureTables();

    const rows = await this.sql.query(
      `SELECT
         c.id,
         c.metadata,
         c.created_at,
         c.updated_at,
         COUNT(m.id)::int AS message_count
       FROM ${this.conversationTable} c
       LEFT JOIN ${this.tableName} m ON m.conversation_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [conversationId],
    ) as Array<{
      id: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
      updated_at: string;
      message_count: number;
    }>;

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      messageCount: row.message_count,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      metadata: row.metadata ?? undefined,
    };
  }

  async listConversations(): Promise<string[]> {
    await this.ensureTables();
    const rows = await this.sql.query(
      `SELECT id FROM ${this.conversationTable} ORDER BY updated_at DESC`,
    ) as Array<{ id: string }>;
    return rows.map((r) => r.id);
  }

  async has(conversationId: string): Promise<boolean> {
    await this.ensureTables();
    const rows = await this.sql.query(
      `SELECT 1 FROM ${this.conversationTable} WHERE id = $1 LIMIT 1`,
      [conversationId],
    ) as Array<Record<string, unknown>>;
    return rows.length > 0;
  }

  /** Set metadata on a conversation */
  async setMetadata(conversationId: string, meta: Record<string, unknown>): Promise<void> {
    await this.ensureTables();
    await this.ensureConversation(conversationId);
    await this.sql.query(
      `UPDATE ${this.conversationTable} SET metadata = $2::jsonb WHERE id = $1`,
      [conversationId, JSON.stringify(meta)],
    );
  }

  /** Get total message count across all conversations */
  async totalMessages(): Promise<number> {
    await this.ensureTables();
    const rows = await this.sql.query(
      `SELECT COUNT(*)::int AS total FROM ${this.tableName}`,
    ) as Array<{ total: number }>;
    return rows[0]?.total ?? 0;
  }

  private estimateTokens(content: string): number {
    return Math.ceil(content.length / this.charsPerToken);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface MessageRow {
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function rowToMessage(row: MessageRow): Message {
  return {
    role: row.role as Message["role"],
    content: row.content,
    timestamp: new Date(row.created_at).getTime(),
    metadata: row.metadata ?? undefined,
  };
}
