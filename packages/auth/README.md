<p align="center">
  <strong>@voltx/auth</strong><br/>
  <em>Better Auth + JWT + API Keys — with Hono middleware</em>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@voltx/auth"><img src="https://img.shields.io/npm/v/@voltx/auth?color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@voltx/auth"><img src="https://img.shields.io/npm/dm/@voltx/auth" alt="downloads" /></a>
  <a href="https://github.com/codewithshail/voltx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@voltx/auth" alt="license" /></a>
</p>

---

Authentication for the [VoltX](https://github.com/codewithshail/voltx) framework. Three providers, one API, native Hono middleware.

| Provider | Best For | Session Storage | Dependencies |
|----------|----------|-----------------|--------------|
| Better Auth | Full-featured apps (email/password, OAuth, sessions) | Database (Postgres, MySQL, SQLite) | `better-auth` |
| JWT | Stateless APIs, microservices | None (token-based) | `jose` |
| API Key | Server-to-server, internal APIs | None (static map) | None |

## Installation

```bash
npm install @voltx/auth
```

Install the provider you need:

```bash
# Better Auth (full-featured)
npm install better-auth

# JWT (stateless)
npm install jose
```

## Quick Start

### Better Auth (Full-Featured)

```ts
import { Hono } from "hono";
import { createAuth, createAuthMiddleware, createAuthHandler } from "@voltx/auth";

const auth = createAuth("better-auth", {
  database: process.env.DATABASE_URL!,
  emailAndPassword: true,
  socialProviders: {
    github: { clientId: "...", clientSecret: "..." },
  },
});

const app = new Hono();

// Mount auth API routes (sign-up, sign-in, OAuth callbacks, etc.)
app.on(["GET", "POST"], "/api/auth/*", createAuthHandler(auth));

// Protect routes
app.use("/api/*", createAuthMiddleware({
  provider: auth,
  publicPaths: ["/api/auth", "/api/health"],
}));

app.get("/api/me", (c) => c.json(c.get("user")));
```

### JWT (Stateless)

```ts
import { createAuth, createAuthMiddleware } from "@voltx/auth";

const jwt = createAuth("jwt", {
  secret: process.env.JWT_SECRET!,
  expiresIn: "7d",
});

// Sign a token in your login route
const token = await jwt.sign({ sub: "user-123", email: "user@example.com" });

// Protect routes
app.use("/api/*", createAuthMiddleware({
  provider: jwt,
  publicPaths: ["/api/auth"],
}));
```

### API Keys (Simple)

```ts
import { createAuth, createAuthMiddleware } from "@voltx/auth";

const apiKey = createAuth("api-key", {
  keys: {
    "sk-live-abc123": { id: "1", email: "admin@example.com", roles: ["admin"] },
    "sk-live-xyz789": { id: "2", email: "reader@example.com", roles: ["read"] },
  },
});

app.use("/api/*", createAuthMiddleware({ provider: apiKey }));
```

## Middleware

### `createAuthMiddleware(config)`

Hono middleware that authenticates requests using any VoltX auth provider.

```ts
createAuthMiddleware({
  provider: auth,              // Any AuthProvider instance
  publicPaths: ["/api/auth"],  // Skip auth for these path prefixes
  optional: false,             // If true, unauthenticated requests pass through (user = null)
});
```

### `createAuthHandler(provider)`

Mount Better Auth API routes for sign-up, sign-in, OAuth, session management.

```ts
app.on(["GET", "POST"], "/api/auth/*", createAuthHandler(auth));
```

### Helpers

```ts
import { getUser, getSession, requireAuth } from "@voltx/auth";

app.get("/api/me", (c) => {
  const user = getUser(c);       // AuthUser | null
  const session = getSession(c); // AuthSession | null
  const user2 = requireAuth(c);  // AuthUser (throws 401 HTTPException if not authenticated)
  return c.json(user);
});
```

## API Reference

### `createAuth(provider, config)`

Factory function to create an auth provider.

| Call | Returns |
|------|---------|
| `createAuth("better-auth", config)` | `BetterAuthProvider` |
| `createAuth("jwt", config?)` | `JWTProvider` |
| `createAuth("api-key", config)` | `APIKeyProvider` |

### `JWTProvider`

| Method | Description |
|--------|-------------|
| `verify(request)` | Verify a Bearer token from the Authorization header |
| `sign(payload)` | Sign a JWT with the configured secret and expiration |
| `decode(token)` | Decode a JWT without verification (for debugging) |

### `BetterAuthProvider`

| Method | Description |
|--------|-------------|
| `verify(request)` | Verify session via Better Auth's `getSession` |
| `handleRequest(request)` | Handle auth API routes (sign-up, sign-in, OAuth, etc.) |

### `APIKeyProvider`

| Method | Description |
|--------|-------------|
| `verify(request)` | Match API key from Authorization header against static key map |

## Types

```ts
interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  emailVerified?: boolean;
  roles?: string[];
  metadata?: Record<string, unknown>;
}

interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

interface AuthProvider {
  name: string;
  verify(request: Request): Promise<SessionResult | null>;
  handleRequest?(request: Request): Promise<Response | null>;
}
```

## Part of VoltX

This package is part of the [VoltX](https://github.com/codewithshail/voltx) framework. See the [monorepo](https://github.com/codewithshail/voltx) for full documentation.

## License

[MIT](https://github.com/codewithshail/voltx/blob/main/LICENSE) — Made by the [Promptly AI Team](https://buymeacoffee.com/promptlyai)
