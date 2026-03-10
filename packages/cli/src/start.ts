// @voltx/cli — Production server start
// Runs the built production bundle from dist/
// Full-stack: serves dist/client/ as static + SSR from dist/server/
// API-only: runs dist/index.mjs directly

import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { loadEnv } from "@voltx/core";

export interface StartOptions {
  /** Port override */
  port?: number;
  /** Output directory where build artifacts live (default: dist) */
  outDir?: string;
  /** Entry file within outDir (default: auto-detect index.js or index.mjs) */
  entry?: string;
}

/**
 * Start the VoltX production server.
 *
 * Runs the built JS bundle from the dist/ directory using Node.js.
 */
export async function runStart(options: StartOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const { port, outDir = "dist" } = options;

  const distDir = resolve(cwd, outDir);

  if (!existsSync(distDir)) {
    console.error(`[voltx] Build output not found at ${outDir}/`);
    console.error("[voltx] Run \`voltx build\` first to create a production build.");
    process.exit(1);
  }

  // Find the entry file in dist/
  const entry = options.entry ?? findDistEntry(distDir);

  if (!entry) {
    console.error(`[voltx] No entry file found in ${outDir}/`);
    console.error("[voltx] Expected index.js, index.mjs, or main.js");
    process.exit(1);
  }

  const entryPath = resolve(distDir, entry);
  if (!existsSync(entryPath)) {
    console.error(`[voltx] Entry file not found: ${outDir}/${entry}`);
    process.exit(1);
  }

  // Load production env vars from .env files
  loadEnv("production", cwd);

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    NODE_ENV: "production",
  };

  if (port) {
    env.PORT = String(port);
  }

  // Detect full-stack build
  const hasClientBuild = existsSync(resolve(distDir, "client"));

  console.log("");
  console.log("  ⚡ VoltX Production Server");
  console.log("  ─────────────────────────────────");
  console.log(`  Entry:   ${outDir}/${entry}`);
  if (port) {
    console.log(`  Port:    ${port}`);
  }
  console.log(`  Mode:    ${hasClientBuild ? "full-stack" : "API-only"}`);
  console.log("  ─────────────────────────────────");
  console.log("");

  const child = spawn("node", [entryPath], {
    cwd,
    env,
    stdio: "inherit",
  });

  // Forward signals
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }

  child.on("error", (err) => {
    console.error("[voltx] Failed to start production server:", err.message);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

/** Find the entry file in the dist directory */
function findDistEntry(distDir: string): string | null {
  const candidates = [
    "server.mjs",
    "server.js",
    "index.mjs",
    "index.js",
    "index.cjs",
    "main.mjs",
    "main.js",
  ];

  for (const candidate of candidates) {
    if (existsSync(join(distDir, candidate))) {
      return candidate;
    }
  }

  return null;
}
