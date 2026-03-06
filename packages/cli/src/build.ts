// @voltx/cli — Production build
// Bundles the VoltX app for production using tsup (server) and optionally Vite (frontend).

import { spawn } from "node:child_process";
import { resolve, join } from "node:path";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

export interface BuildOptions {
  /** Entry file (default: src/index.ts) */
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
 * Uses tsup to bundle the server-side TypeScript into a single optimized JS file.
 * If a frontend directory exists (src/frontend), also builds it with Vite.
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
    console.error("[voltx] Could not find entry point. Expected src/index.ts");
    process.exit(1);
  }

  const entryPath = resolve(cwd, entry);
  if (!existsSync(entryPath)) {
    console.error(`[voltx] Entry file not found: ${entry}`);
    process.exit(1);
  }

  console.log("");
  console.log("  ⚡ VoltX Build");
  console.log("  ─────────────────────────────────");
  console.log(`  Entry:   ${entry}`);
  console.log(`  Output:  ${outDir}/`);
  console.log(`  Minify:  ${minify}`);
  console.log("  ─────────────────────────────────");
  console.log("");

  // Ensure output directory exists
  mkdirSync(resolve(cwd, outDir), { recursive: true });

  // ─── Step 1: Build server with tsup ────────────────────────────────

  console.log("  [1/2] Building server...");

  const tsupArgs = [
    entry,
    "--format", "esm",
    "--out-dir", outDir,
    "--clean",
    "--target", "node20",
  ];

  if (minify) tsupArgs.push("--minify");
  if (sourcemap) tsupArgs.push("--sourcemap");

  // Add external packages — don't bundle node_modules
  // tsup auto-externalizes dependencies from package.json
  tsupArgs.push("--no-splitting");

  const tsupBin = findBin(cwd, "tsup");

  await runCommand(
    tsupBin ?? "npx",
    tsupBin ? tsupArgs : ["tsup", ...tsupArgs],
    cwd,
  );

  console.log("  ✓ Server built successfully");

  // ─── Step 2: Build frontend with Vite (if present) ─────────────────

  const frontendDir = resolve(cwd, "src", "frontend");
  const viteConfig = resolve(cwd, "vite.config.ts");
  const hasFrontend = existsSync(frontendDir) || existsSync(viteConfig);

  if (hasFrontend) {
    console.log("  [2/2] Building frontend...");

    const viteBin = findBin(cwd, "vite");
    const viteArgs = ["build", "--outDir", join(outDir, "public")];

    await runCommand(
      viteBin ?? "npx",
      viteBin ? viteArgs : ["vite", ...viteArgs],
      cwd,
    );

    console.log("  ✓ Frontend built successfully");
  } else {
    console.log("  [2/2] No frontend found, skipping...");
  }

  console.log("");
  console.log("  ⚡ Build complete!");
  console.log(`  Run \`voltx start\` to start the production server.`);
  console.log("");
}

/** Find the app entry point */
function findEntryPoint(cwd: string): string | null {
  const candidates = [
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
