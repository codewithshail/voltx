// @voltx/memory — Conversation memory for agents and chat
//
// Usage:
//   import { createMemory } from "@voltx/memory";
//
//   // In-memory (dev/testing)
//   const memory = createMemory({ maxMessages: 50 });
//
//   // Postgres (production)
//   const memory = createMemory("postgres", { url: process.env.DATABASE_URL! });

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  Message,
  ConversationInfo,
  MemoryStore,
  MemoryConfig,
  PostgresMemoryConfig,
} from "./types.js";

// ─── Stores ──────────────────────────────────────────────────────────────────

export { InMemoryStore } from "./in-memory.js";
export { PostgresStore } from "./postgres.js";

// ─── Factory ─────────────────────────────────────────────────────────────────

import type { MemoryConfig, PostgresMemoryConfig, MemoryStore } from "./types.js";
import { InMemoryStore } from "./in-memory.js";
import { PostgresStore } from "./postgres.js";

/**
 * Create a memory store.
 *
 * @example
 * ```ts
 * // In-memory (default, for dev/testing)
 * const memory = createMemory({ maxMessages: 50 });
 *
 * // Postgres (production, uses Neon serverless driver)
 * const memory = createMemory("postgres", { url: process.env.DATABASE_URL! });
 * ```
 */
export function createMemory(config?: MemoryConfig): InMemoryStore;
export function createMemory(provider: "postgres", config?: PostgresMemoryConfig): PostgresStore;
export function createMemory(provider: "in-memory", config?: MemoryConfig): InMemoryStore;
export function createMemory(
  providerOrConfig?: string | MemoryConfig,
  config?: MemoryConfig | PostgresMemoryConfig,
): MemoryStore {
  if (typeof providerOrConfig === "string") {
    switch (providerOrConfig) {
      case "postgres":
        return new PostgresStore(config as PostgresMemoryConfig);
      case "in-memory":
      default:
        return new InMemoryStore(config);
    }
  }
  return new InMemoryStore(providerOrConfig);
}

// ─── Version ─────────────────────────────────────────────────────────────────

export const VERSION = "0.4.2";
