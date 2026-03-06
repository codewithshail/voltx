// @voltx/auth — Hono middleware
// Native Hono middleware for protecting routes with any VoltX auth provider.

import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AuthMiddlewareConfig, AuthUser, AuthSession } from "./types.js";

/**
 * Create a Hono middleware that authenticates requests using a VoltX auth provider.
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { createAuthMiddleware, JWTProvider } from "@voltx/auth";
 *
 * const app = new Hono();
 * const jwt = new JWTProvider({ secret: "my-secret" });
 *
 * // Protect all routes except public ones
 * app.use("*", createAuthMiddleware({
 *   provider: jwt,
 *   publicPaths: ["/api/auth", "/health"],
 * }));
 *
 * // Access user in route handlers
 * app.get("/me", (c) => {
 *   const user = c.get("user");
 *   return c.json(user);
 * });
 * ```
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const { provider, publicPaths = [], optional = false } = config;

  return async (c: Context, next: () => Promise<void>) => {
    const path = new URL(c.req.url).pathname;

    // Skip auth for public paths
    if (publicPaths.some((p) => path.startsWith(p))) {
      c.set("user", null);
      c.set("session", null);
      return next();
    }

    // Verify the request
    const result = await provider.verify(c.req.raw);

    if (!result) {
      if (optional) {
        c.set("user", null);
        c.set("session", null);
        return next();
      }
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Set user and session on the Hono context
    c.set("user", result.user);
    c.set("session", result.session);
    return next();
  };
}

/**
 * Create a Hono middleware that mounts Better Auth API routes.
 * Handles sign-up, sign-in, sign-out, OAuth callbacks, session management, etc.
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { createAuthHandler, BetterAuthProvider } from "@voltx/auth";
 *
 * const app = new Hono();
 * const auth = new BetterAuthProvider({ database: process.env.DATABASE_URL });
 *
 * // Mount auth routes at /api/auth/*
 * app.on(["GET", "POST"], "/api/auth/*", createAuthHandler(auth));
 * ```
 */
export function createAuthHandler(provider: { handleRequest?(request: Request): Promise<Response | null> }) {
  return async (c: Context) => {
    if (!provider.handleRequest) {
      return c.json({ error: "Auth provider does not support route handling" }, 501);
    }

    const response = await provider.handleRequest(c.req.raw);
    if (!response) {
      return c.json({ error: "Auth handler returned no response" }, 500);
    }

    return response;
  };
}

/**
 * Helper to get the authenticated user from a Hono context.
 * Returns null if the user is not authenticated.
 */
export function getUser(c: Context): AuthUser | null {
  return c.get("user") ?? null;
}

/**
 * Helper to get the session from a Hono context.
 * Returns null if there is no active session.
 */
export function getSession(c: Context): AuthSession | null {
  return c.get("session") ?? null;
}

/**
 * Helper to require authentication. Throws a 401 HTTPException if not authenticated.
 */
export function requireAuth(c: Context): AuthUser {
  const user = getUser(c);
  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  return user;
}
