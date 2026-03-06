// @voltx/db — Drizzle ORM setup with Neon serverless driver
//
// Usage:
//   import { createDB } from "@voltx/db";
//   const db = createDB({ url: process.env.DATABASE_URL! });
//   const users = await db.select().from(usersTable);

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { DatabaseConfig } from "./types.js";

export type DrizzleDB = NeonHttpDatabase;

/**
 * Create a Drizzle ORM instance connected to Neon Postgres (or any Postgres via HTTP).
 *
 * @example
 * ```ts
 * import { createDB } from "@voltx/db";
 *
 * const db = createDB({ url: process.env.DATABASE_URL! });
 * const rows = await db.select().from(myTable);
 * ```
 */
export function createDB(config: DatabaseConfig): DrizzleDB {
  const sql = neon(config.url);
  return drizzleNeonHttp({ client: sql });
}
