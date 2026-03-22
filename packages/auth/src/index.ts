// @voltx/auth — Authentication for VoltX
//
// Supports: Better Auth (full-featured), JWT (stateless), API Keys (simple)
//
// Usage:
//   import { JWTProvider, createAuthMiddleware } from "@voltx/auth";
//
//   const jwt = new JWTProvider({ secret: "my-secret" });
//   app.use("*", createAuthMiddleware({ provider: jwt }));

// ─── Types ───────────────────────────────────────────────────────────────────

export type {
  AuthUser,
  AuthSession,
  SessionResult,
  AuthProvider,
  BetterAuthConfig,
  JWTConfig,
  JWTPayload,
  APIKeyConfig,
  AuthMiddlewareConfig,
} from "./types.js";

// ─── Providers ───────────────────────────────────────────────────────────────

export { BetterAuthProvider } from "./providers/better-auth.js";
export { JWTProvider } from "./providers/jwt.js";
export { APIKeyProvider } from "./providers/api-key.js";

// ─── Middleware (Hono-native) ────────────────────────────────────────────────

export {
  createAuthMiddleware,
  createAuthHandler,
  getUser,
  getSession,
  requireAuth,
} from "./middleware.js";

// ─── Factory ─────────────────────────────────────────────────────────────────

import type { AuthProvider, BetterAuthConfig, JWTConfig, APIKeyConfig } from "./types.js";
import { BetterAuthProvider } from "./providers/better-auth.js";
import { JWTProvider } from "./providers/jwt.js";
import { APIKeyProvider } from "./providers/api-key.js";

/**
 * Create an auth provider.
 *
 * @example
 * ```ts
 * // Better Auth (full-featured, DB-backed)
 * const auth = createAuth("better-auth", {
 *   database: process.env.DATABASE_URL!,
 *   emailAndPassword: true,
 *   socialProviders: {
 *     github: { clientId: "...", clientSecret: "..." },
 *   },
 * });
 *
 * // JWT (stateless)
 * const auth = createAuth("jwt", { secret: "my-secret", expiresIn: "7d" });
 *
 * // API Keys (simple)
 * const auth = createAuth("api-key", {
 *   keys: { "sk-my-key": { id: "1", email: "admin@example.com" } },
 * });
 * ```
 */
export function createAuth(provider: "better-auth", config: BetterAuthConfig): BetterAuthProvider;
export function createAuth(provider: "jwt", config?: JWTConfig): JWTProvider;
export function createAuth(provider: "api-key", config: APIKeyConfig): APIKeyProvider;
export function createAuth(
  provider: string,
  config?: BetterAuthConfig | JWTConfig | APIKeyConfig,
): AuthProvider {
  switch (provider) {
    case "better-auth":
      return new BetterAuthProvider(config as BetterAuthConfig);
    case "jwt":
      return new JWTProvider(config as JWTConfig);
    case "api-key":
      return new APIKeyProvider(config as APIKeyConfig);
    default:
      throw new Error(`[voltx/auth] Unknown auth provider: "${provider}". Use "better-auth", "jwt", or "api-key".`);
  }
}

// ─── Version ─────────────────────────────────────────────────────────────────

export const VERSION = "0.4.5";
