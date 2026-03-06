// @voltx/cli — Production server start
// Runs the built production bundle from dist/

import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

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

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    NODE_ENV: "production",
  };

  // Parse .env file and inject into environment
  const envFile = resolve(cwd, ".env");
  if (existsSync(envFile)) {
    const envContent = readFileSync(envFile, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      env[key] = value;
    }
  }

  if (port) {
    env.PORT = String(port);
  }

  console.log("");
  console.log("  ⚡ VoltX Production Server");
  console.log("  ─────────────────────────────────");
  console.log(`  Entry:   ${outDir}/${entry}`);
  if (port) {
    console.log(`  Port:    ${port}`);
  }
  console.log(`  Mode:    production`);
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
    "index.mjs",
    "index.js",
    "index.cjs",
    "main.mjs",
    "main.js",
    "src/index.mjs",
    "src/index.js",
  ];

  for (const candidate of candidates) {
    if (existsSync(join(distDir, candidate))) {
      return candidate;
    }
  }

  return null;
}
