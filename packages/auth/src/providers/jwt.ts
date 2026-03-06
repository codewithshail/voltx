// @voltx/auth — JWT provider
// Stateless JWT authentication using the `jose` library (Web Crypto API, no native deps).

import type { AuthProvider, SessionResult, JWTConfig, JWTPayload, AuthUser } from "../types.js";

// We use dynamic import for jose to keep it as an optional peer dependency.
// Users who choose JWT auth install jose themselves.

let joseModule: typeof import("jose") | null = null;

async function getJose(): Promise<typeof import("jose")> {
  if (!joseModule) {
    try {
      joseModule = await import("jose");
    } catch {
      throw new Error(
        '[voltx/auth] JWT provider requires the "jose" package. Install it: npm install jose',
      );
    }
  }
  return joseModule;
}

function resolveSecret(config: JWTConfig): string {
  const secret = config.secret ?? process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "[voltx/auth] JWT secret is required. Set config.secret or JWT_SECRET env var.",
    );
  }
  return secret;
}

function parseExpiresIn(expiresIn: string | number | undefined): string {
  if (!expiresIn) return "7d";
  if (typeof expiresIn === "number") return `${expiresIn}s`;
  return expiresIn;
}

export class JWTProvider implements AuthProvider {
  name = "jwt";
  private config: JWTConfig;

  constructor(config: JWTConfig = {}) {
    this.config = config;
  }

  async verify(request: Request): Promise<SessionResult | null> {
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;

    const token = header.slice(7);
    const jose = await getJose();
    const secret = resolveSecret(this.config);
    const secretKey = new TextEncoder().encode(secret);

    try {
      const { payload } = await jose.jwtVerify(token, secretKey, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm ?? "HS256"],
      });

      const jwtPayload = payload as unknown as JWTPayload;

      if (!jwtPayload.sub) return null;

      const user: AuthUser = {
        id: jwtPayload.sub,
        email: jwtPayload.email ?? "",
        name: jwtPayload.name,
        roles: jwtPayload.roles,
      };

      return {
        user,
        session: {
          id: `jwt-${jwtPayload.sub}`,
          userId: jwtPayload.sub,
          token,
          expiresAt: jwtPayload.exp
            ? new Date(jwtPayload.exp * 1000)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Sign a JWT token. Use this in your login/signup routes.
   *
   * @example
   * ```ts
   * const jwt = new JWTProvider({ secret: "my-secret" });
   * const token = await jwt.sign({ sub: "user-123", email: "user@example.com" });
   * ```
   */
  async sign(payload: JWTPayload): Promise<string> {
    const jose = await getJose();
    const secret = resolveSecret(this.config);
    const secretKey = new TextEncoder().encode(secret);
    const alg = this.config.algorithm ?? "HS256";
    const exp = parseExpiresIn(this.config.expiresIn);

    let builder = new jose.SignJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime(exp);

    if (this.config.issuer) builder = builder.setIssuer(this.config.issuer);
    if (this.config.audience) builder = builder.setAudience(this.config.audience);
    if (payload.sub) builder = builder.setSubject(payload.sub);

    return builder.sign(secretKey);
  }

  /**
   * Decode a JWT without verifying (useful for debugging).
   */
  async decode(token: string): Promise<JWTPayload | null> {
    const jose = await getJose();
    try {
      const decoded = jose.decodeJwt(token);
      return decoded as unknown as JWTPayload;
    } catch {
      return null;
    }
  }
}
