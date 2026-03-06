// @voltx/auth — Core types

// ─── User & Session ──────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
  emailVerified?: boolean;
  roles?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface SessionResult {
  user: AuthUser;
  session: AuthSession;
}

// ─── Auth Provider Interface ─────────────────────────────────────────────────

export interface AuthProvider {
  name: string;
  /** Verify a request and return user + session, or null if unauthenticated */
  verify(request: Request): Promise<SessionResult | null>;
  /**
   * Handle auth API routes (e.g. /api/auth/*).
   * Returns a Response if the provider handles the route, or null to skip.
   */
  handleRequest?(request: Request): Promise<Response | null>;
}

// ─── Better Auth Config ──────────────────────────────────────────────────────

export interface BetterAuthConfig {
  /** Secret key for encryption (min 32 chars). Falls back to BETTER_AUTH_SECRET env var. */
  secret?: string;
  /** Base URL of the app. Falls back to BETTER_AUTH_URL env var. */
  baseURL?: string;
  /** Base path for auth routes (default: "/api/auth") */
  basePath?: string;
  /** Database connection string or Drizzle instance */
  database: string | unknown;
  /** Database provider for Drizzle adapter: "pg" | "mysql" | "sqlite" */
  databaseProvider?: "pg" | "mysql" | "sqlite";
  /** Enable email/password authentication (default: true) */
  emailAndPassword?: boolean;
  /** Social/OAuth providers */
  socialProviders?: {
    github?: { clientId: string; clientSecret: string };
    google?: { clientId: string; clientSecret: string };
    discord?: { clientId: string; clientSecret: string };
  };
  /** Additional Better Auth options (passed through) */
  options?: Record<string, unknown>;
}

// ─── JWT Config ──────────────────────────────────────────────────────────────

export interface JWTConfig {
  /** Secret key for signing JWTs. Falls back to JWT_SECRET env var. */
  secret?: string;
  /** JWT issuer claim */
  issuer?: string;
  /** JWT audience claim */
  audience?: string;
  /** Token expiration (default: "7d"). Accepts ms-style strings or seconds. */
  expiresIn?: string | number;
  /** Algorithm (default: "HS256") */
  algorithm?: "HS256" | "HS384" | "HS512";
}

export interface JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
  [key: string]: unknown;
}

// ─── API Key Config ──────────────────────────────────────────────────────────

export interface APIKeyConfig {
  /** Map of API key → user data */
  keys: Record<string, AuthUser>;
  /** Header name to read the key from (default: "Authorization" with "Bearer " prefix) */
  headerName?: string;
}

// ─── Middleware Config ───────────────────────────────────────────────────────

export interface AuthMiddlewareConfig {
  /** Auth provider instance */
  provider: AuthProvider;
  /** Routes that don't require authentication (glob-style prefixes) */
  publicPaths?: string[];
  /** If true, unauthenticated requests are allowed through (user will be null) */
  optional?: boolean;
}
