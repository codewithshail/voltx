// @voltx/core — Multi-environment .env loader
// Loads .env files with proper precedence, variable expansion, and public env extraction.
// Matches Next.js / Vite loading order: .env → .env.local → .env.{mode} → .env.{mode}.local

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Load environment variables from multiple .env files.
 *
 * Loading order (later files override earlier):
 *   .env                    — Base defaults (committed to git)
 *   .env.local              — Local overrides (gitignored)
 *   .env.{mode}             — Environment-specific (.env.development, .env.production)
 *   .env.{mode}.local       — Environment + local overrides (gitignored)
 *
 * Existing process.env values are NOT overwritten (shell-set vars take priority).
 */
export function loadEnv(
  mode: string = process.env.NODE_ENV ?? "development",
  cwd: string = process.cwd(),
): Record<string, string> {
  const files = [
    ".env",
    ".env.local",
    `.env.${mode}`,
    `.env.${mode}.local`,
  ];

  const loaded: Record<string, string> = {};

  for (const file of files) {
    const filePath = resolve(cwd, file);
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;

      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();

      // Strip surrounding quotes (double or single)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Variable expansion: ${VAR_NAME}
      value = value.replace(/\$\{(\w+)\}/g, (_, name) => {
        return loaded[name] ?? process.env[name] ?? "";
      });

      loaded[key] = value;
    }
  }

  // Apply to process.env — don't overwrite existing values
  for (const [key, value] of Object.entries(loaded)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return loaded;
}

/**
 * Get all public env vars (VOLTX_PUBLIC_* prefix) for frontend injection.
 * These are safe to expose to the browser via window.__VOLTX_ENV__.
 */
export function getPublicEnv(): Record<string, string> {
  const publicEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("VOLTX_PUBLIC_") && value !== undefined) {
      publicEnv[key] = value;
    }
  }
  return publicEnv;
}
