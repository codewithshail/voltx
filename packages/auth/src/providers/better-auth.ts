// @voltx/auth — Better Auth provider
// Full-featured auth with email/password, OAuth, sessions, and DB-backed storage.
// Uses the `better-auth` package with Drizzle adapter.

import type { AuthProvider, SessionResult, BetterAuthConfig, AuthUser } from "../types.js";

// Dynamic import — better-auth is an optional peer dependency.
// Users who choose Better Auth install it themselves.

let betterAuthInstance: unknown | null = null;

interface BetterAuthAPI {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (opts: { headers: Headers }) => Promise<{
      user: { id: string; email: string; name: string; image?: string; emailVerified: boolean };
      session: { id: string; userId: string; token: string; expiresAt: Date };
    } | null>;
  };
}

async function createBetterAuthInstance(config: BetterAuthConfig): Promise<BetterAuthAPI> {
  if (betterAuthInstance) return betterAuthInstance as BetterAuthAPI;

  let betterAuth: (opts: Record<string, unknown>) => unknown;
  try {
    const mod = await import("better-auth");
    betterAuth = mod.betterAuth;
  } catch {
    throw new Error(
      '[voltx/auth] Better Auth provider requires the "better-auth" package. Install it: npm install better-auth',
    );
  }

  const secret = config.secret ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "[voltx/auth] Better Auth secret is required. Set config.secret or BETTER_AUTH_SECRET env var (min 32 chars).",
    );
  }

  const baseURL = config.baseURL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const basePath = config.basePath ?? "/api/auth";

  // Build the Better Auth options
  // Spread user options first, then our required fields so they can't be accidentally overwritten
  const authOptions: Record<string, unknown> = {
    ...config.options,
    secret,
    baseURL,
    basePath,
  };

  // Database configuration
  if (typeof config.database === "string") {
    // Connection string — let Better Auth use its built-in Kysely adapter
    authOptions.database = { url: config.database, type: config.databaseProvider ?? "pg" };
  } else if (config.database) {
    // Drizzle instance — use the Drizzle adapter
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const drizzleMod: any = await import("better-auth/adapters/drizzle");
      authOptions.database = drizzleMod.drizzleAdapter(config.database, {
        provider: config.databaseProvider ?? "pg",
      });
    } catch {
      // If drizzle adapter import fails, pass the database directly
      authOptions.database = config.database;
    }
  }

  // Email/password
  if (config.emailAndPassword !== false) {
    authOptions.emailAndPassword = { enabled: true };
  }

  // Social providers
  if (config.socialProviders) {
    authOptions.socialProviders = config.socialProviders;
  }

  betterAuthInstance = betterAuth(authOptions);
  return betterAuthInstance as BetterAuthAPI;
}

export class BetterAuthProvider implements AuthProvider {
  name = "better-auth";
  private config: BetterAuthConfig;
  private authPromise: Promise<BetterAuthAPI> | null = null;

  constructor(config: BetterAuthConfig) {
    this.config = config;
  }

  private getAuth(): Promise<BetterAuthAPI> {
    if (!this.authPromise) {
      this.authPromise = createBetterAuthInstance(this.config);
    }
    return this.authPromise;
  }

  async verify(request: Request): Promise<SessionResult | null> {
    const auth = await this.getAuth();

    try {
      const result = await auth.api.getSession({ headers: request.headers });
      if (!result) return null;

      const user: AuthUser = {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        image: result.user.image,
        emailVerified: result.user.emailVerified,
      };

      return {
        user,
        session: {
          id: result.session.id,
          userId: result.session.userId,
          token: result.session.token,
          expiresAt: new Date(result.session.expiresAt),
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Handle Better Auth API routes (e.g. /api/auth/*).
   * Mount this on your Hono app to handle sign-up, sign-in, OAuth callbacks, etc.
   */
  async handleRequest(request: Request): Promise<Response | null> {
    const auth = await this.getAuth();
    try {
      return await auth.handler(request);
    } catch {
      return null;
    }
  }
}
