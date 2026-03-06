// @voltx/db — Default schema helpers for common AI app tables
// Users can import these and extend them, or define their own schema from scratch.

import { pgTable, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";

// ─── Conversations ───────────────────────────────────────────────────────────

export const conversations = pgTable("voltx_conversations", {
  id: text("id").primaryKey(),
  title: text("title"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Messages ────────────────────────────────────────────────────────────────

export const messages = pgTable(
  "voltx_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role", { enum: ["system", "user", "assistant", "tool"] }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("messages_conversation_idx").on(table.conversationId),
  ],
);

// ─── Documents (for RAG) ─────────────────────────────────────────────────────

export const documents = pgTable("voltx_documents", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  source: text("source"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  chunkIndex: integer("chunk_index"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
