// @voltx/auth — API Key provider
// Simple static API key authentication. Good for server-to-server or internal APIs.

import type { AuthProvider, AuthUser, SessionResult, APIKeyConfig } from "../types.js";

export class APIKeyProvider implements AuthProvider {
  name = "api-key";
  private keys: Map<string, AuthUser>;
  private headerName: string;
  private useBearer: boolean;

  constructor(config: APIKeyConfig) {
    this.keys = new Map(Object.entries(config.keys));
    this.headerName = config.headerName ?? "authorization";
    // Only strip "Bearer " prefix when using the default Authorization header
    this.useBearer = !config.headerName || config.headerName.toLowerCase() === "authorization";
  }

  async verify(request: Request): Promise<SessionResult | null> {
    const header = request.headers.get(this.headerName);
    if (!header) return null;

    // Strip "Bearer " prefix only for Authorization header
    const token = this.useBearer && header.startsWith("Bearer ") ? header.slice(7) : header;
    const user = this.keys.get(token);
    if (!user) return null;

    return {
      user,
      session: {
        id: `apikey-${user.id}`,
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // API keys don't expire
      },
    };
  }
}
