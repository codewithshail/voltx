// @voltx/cli — Dev server with hot reload
// Uses tsx watch to run the app entry point with automatic restarts on file changes.

import { spawn, type ChildProcess } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export interface DevOptions {
  /** Port override (reads from voltx.config.ts or env if not set) */
  port?: number;
  /** Entry file (default: src/index.ts) */
  entry?: string;
  /** Extra directories to watch */
  watch?: string[];
  /** Clear console on restart */
  clearScreen?: boolean;
}

/**
 * Start the VoltX dev server with hot reload.
 *
 * Spawns `tsx watch` on the app entry point. tsx handles TypeScript
 * compilation and automatic restarts when files change.
 */
export async function runDev(options: DevOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const {
    port,
    entry = findEntryPoint(cwd),
    clearScreen = true,
  } = options;

  if (!entry) {
    console.error("[voltx] Could not find entry point. Expected src/index.ts or src/index.js");
    process.exit(1);
  }

  const entryPath = resolve(cwd, entry);
  if (!existsSync(entryPath)) {
    console.error(`[voltx] Entry file not found: ${entry}`);
    process.exit(1);
  }

  // Load .env file if it exists
  const envFile = resolve(cwd, ".env");
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    NODE_ENV: "development",
  };

  // Parse .env file and inject into environment
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

  // Print startup banner
  printDevBanner(entry, port);

  // Build tsx watch args
  const tsxArgs = ["watch"];

  if (clearScreen) {
    tsxArgs.push("--clear-screen=false");
  }

  // Watch additional directories for changes
  const watchDirs = [
    "src/routes",
    "src/agents",
    "src/tools",
    "src/jobs",
    "src/lib",
    "voltx.config.ts",
    ...(options.watch ?? []),
  ];

  // tsx watch doesn't need explicit --watch paths — it watches all imported files.
  // But we can add ignore patterns to avoid unnecessary restarts.
  tsxArgs.push("--ignore=node_modules", "--ignore=dist", "--ignore=.turbo");

  tsxArgs.push(entry);

  // Resolve tsx binary — prefer local, fall back to npx
  const tsxBin = findTsxBin(cwd);

  let child: ChildProcess;

  if (tsxBin) {
    child = spawn(tsxBin, tsxArgs, {
      cwd,
      env,
      stdio: "inherit",
    });
  } else {
    // Fall back to npx tsx
    child = spawn("npx", ["tsx", ...tsxArgs], {
      cwd,
      env,
      stdio: "inherit",
    });
  }

  // Forward signals to child process
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }

  child.on("error", (err) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.error("[voltx] tsx not found. Install it with: npm install -D tsx");
      console.error("[voltx] Or run your app directly: npx tsx watch src/index.ts");
    } else {
      console.error("[voltx] Dev server error:", err.message);
    }
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

/** Find the app entry point */
function findEntryPoint(cwd: string): string | null {
  const candidates = [
    "src/index.ts",
    "src/index.js",
    "src/index.mts",
    "src/main.ts",
    "src/main.js",
    "index.ts",
    "index.js",
  ];

  for (const candidate of candidates) {
    if (existsSync(join(cwd, candidate))) {
      return candidate;
    }
  }

  return null;
}

/** Find the tsx binary in node_modules/.bin */
function findTsxBin(cwd: string): string | null {
  const localBin = join(cwd, "node_modules", ".bin", "tsx");
  if (existsSync(localBin)) return localBin;

  // Check parent directories (monorepo support)
  const parentBin = join(cwd, "..", "node_modules", ".bin", "tsx");
  if (existsSync(parentBin)) return parentBin;

  const rootBin = join(cwd, "..", "..", "node_modules", ".bin", "tsx");
  if (existsSync(rootBin)) return rootBin;

  return null;
}

/** Print the dev startup banner */
function printDevBanner(entry: string, port?: number): void {
  console.log("");
  console.log("  ⚡ VoltX Dev Server");
  console.log("  ─────────────────────────────────");
  console.log(`  Entry:   ${entry}`);
  if (port) {
    console.log(`  Port:    ${port}`);
  }
  console.log(`  Mode:    development (hot reload)`);
  console.log("  ─────────────────────────────────");
  console.log("");
}
