// @voltx/cli — Production build
// Full-stack: 3-phase build (client + SSR + server)
// API-only: single server build with tsup

import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { loadEnv } from "@voltx/core";

export interface BuildOptions {
  /** Entry file (default: server.ts or src/index.ts) */
  entry?: string;
  /** Output directory (default: dist) */
  outDir?: string;
  /** Minify output (default: true) */
  minify?: boolean;
  /** Generate sourcemaps (default: false) */
  sourcemap?: boolean;
}

/**
 * Build the VoltX app for production.
 *
 * Detects whether the project is full-stack (has vite.config.ts or server.ts).
 * - Full-stack: builds client bundle, SSR bundle, and server bundle
 * - API-only: builds server bundle only (existing behavior)
 */
export async function runBuild(options: BuildOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const {
    entry = findEntryPoint(cwd),
    outDir = "dist",
    minify = true,
    sourcemap = false,
  } = options;

  if (!entry) {
    console.error("[voltx] Could not find entry point. Expected server.ts or src/index.ts");
    process.exit(1);
  }

  const entryPath = resolve(cwd, entry);
  if (!existsSync(entryPath)) {
    console.error(`[voltx] Entry file not found: ${entry}`);
    process.exit(1);
  }

  // Load production env vars
  loadEnv("production", cwd);

  // Full-stack if vite.config.ts exists or server.ts exists
  const hasViteConfig = existsSync(resolve(cwd, "vite.config.ts"));
  const hasServerEntry = existsSync(resolve(cwd, "server.ts"));
  const isFullStack = hasViteConfig || hasServerEntry;

  console.log("");
  console.log("  ⚡ VoltX Build");
  console.log("  ─────────────────────────────────");
  console.log(`  Entry:   ${entry}`);
  console.log(`  Output:  ${outDir}/`);
  console.log(`  Mode:    ${isFullStack ? "full-stack" : "API-only"}`);
  console.log(`  Minify:  ${minify}`);
  console.log("  ─────────────────────────────────");
  console.log("");

  // Ensure output directory exists
  mkdirSync(resolve(cwd, outDir), { recursive: true });

  if (isFullStack) {
    await buildFullStack(cwd, entry, outDir, minify, sourcemap);
  } else {
    await buildApiOnly(cwd, entry, outDir, minify, sourcemap);
  }

  console.log("");
  console.log("  ⚡ Build complete!");
  console.log(`  Run \`voltx start\` to start the production server.`);
  console.log("");
}


// ─── Full-stack build (client + SSR + server) ────────────────────────────────

async function buildFullStack(
  cwd: string,
  entry: string,
  outDir: string,
  minify: boolean,
  sourcemap: boolean,
): Promise<void> {
  // Check if SSR entry exists
  const ssrEntry = existsSync(join(cwd, "src", "entry-server.tsx"))
    ? "src/entry-server.tsx"
    : null;
  const totalSteps = ssrEntry ? 3 : 2;

  // Step 1: Build client bundle with Vite
  console.log(`  [1/${totalSteps}] Building client...`);
  const viteBin = findBin(cwd, "vite");
  const clientOutDir = join(outDir, "client");

  await runCommand(
    viteBin ?? "npx",
    viteBin
      ? ["build", "--outDir", clientOutDir]
      : ["vite", "build", "--outDir", clientOutDir],
    cwd,
  );
  console.log("  ✓ Client built");

  // Step 2: Build SSR bundle (if entry-server.tsx exists)
  if (ssrEntry) {
    console.log(`  [2/${totalSteps}] Building SSR bundle...`);
    const serverOutDir = join(outDir, "server");

    await runCommand(
      viteBin ?? "npx",
      viteBin
        ? ["build", "--ssr", ssrEntry, "--outDir", serverOutDir]
        : ["vite", "build", "--ssr", ssrEntry, "--outDir", serverOutDir],
      cwd,
    );
    console.log("  ✓ SSR bundle built");
  }

  // Step 3 (or 2): Build server with tsup (no --clean to preserve client/SSR bundles)
  const serverStep = ssrEntry ? 3 : 2;
  console.log(`  [${serverStep}/${totalSteps}] Building server...`);
  await buildServer(cwd, entry, outDir, minify, sourcemap, false);
  console.log("  ✓ Server built");
}

// ─── API-only build (server only) ────────────────────────────────────────────

async function buildApiOnly(
  cwd: string,
  entry: string,
  outDir: string,
  minify: boolean,
  sourcemap: boolean,
): Promise<void> {
  console.log("  [1/1] Building server...");
  await buildServer(cwd, entry, outDir, minify, sourcemap);
  console.log("  ✓ Server built");
}

// ─── Server build (tsup) ─────────────────────────────────────────────────────

async function buildServer(
  cwd: string,
  entry: string,
  outDir: string,
  minify: boolean,
  sourcemap: boolean,
  clean: boolean = true,
): Promise<void> {
  const tsupBin = findBin(cwd, "tsup");
  const tsupArgs = [
    entry,
    "--format", "esm",
    "--out-dir", outDir,
    "--target", "node20",
    "--no-splitting",
  ];

  if (clean) tsupArgs.push("--clean");
  if (minify) tsupArgs.push("--minify");
  if (sourcemap) tsupArgs.push("--sourcemap");

  await runCommand(
    tsupBin ?? "npx",
    tsupBin ? tsupArgs : ["tsup", ...tsupArgs],
    cwd,
  );
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Find the app entry point */
function findEntryPoint(cwd: string): string | null {
  const candidates = [
    "server.ts",
    "server.js",
    "src/index.ts",
    "src/index.js",
    "src/index.mts",
    "src/main.ts",
    "src/main.js",
  ];

  for (const candidate of candidates) {
    if (existsSync(join(cwd, candidate))) {
      return candidate;
    }
  }

  return null;
}

/** Find a binary in node_modules/.bin */
function findBin(cwd: string, name: string): string | null {
  const paths = [
    join(cwd, "node_modules", ".bin", name),
    join(cwd, "..", "node_modules", ".bin", name),
    join(cwd, "..", "..", "node_modules", ".bin", name),
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }

  return null;
}

/** Run a command and wait for it to finish */
function runCommand(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "production" },
    });

    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        console.error(`[voltx] ${cmd} not found. Install it with: npm install -D ${cmd}`);
      }
      reject(err);
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}
