#!/usr/bin/env node
// @voltx/cli — Main CLI entry point
// Commands: create, dev, build, start, generate

const args = process.argv.slice(2);
const command = args[0];

function parseFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

function parsePort(): number | undefined {
  const portStr = parseFlag("--port") ?? parseFlag("-p");
  return portStr ? Number(portStr) : undefined;
}

async function main() {
  switch (command) {
    // ─── voltx create ──────────────────────────────────────────────────
    case "create": {
      const projectName = args[1];
      if (!projectName || projectName.startsWith("-")) {
        console.error("[voltx] Usage: voltx create <project-name> [--template chatbot|rag-app|agent-app] [--auth better-auth|jwt|none]");
        process.exit(1);
      }
      const template = parseFlag("--template") as "chatbot" | "rag-app" | "agent-app" | "blank" | undefined;
      const auth = parseFlag("--auth") as "better-auth" | "jwt" | "none" | undefined;
      const { createProject } = await import("./create.js");
      await createProject({ name: projectName, template: template ?? "blank", auth: auth ?? "none" });
      break;
    }

    // ─── voltx dev ─────────────────────────────────────────────────────
    case "dev": {
      const { runDev } = await import("./dev.js");
      await runDev({
        port: parsePort(),
        entry: parseFlag("--entry"),
        clearScreen: !hasFlag("--no-clear"),
      });
      break;
    }

    // ─── voltx build ───────────────────────────────────────────────────
    case "build": {
      const { runBuild } = await import("./build.js");
      await runBuild({
        entry: parseFlag("--entry"),
        outDir: parseFlag("--out-dir") ?? parseFlag("-o"),
        minify: !hasFlag("--no-minify"),
        sourcemap: hasFlag("--sourcemap"),
      });
      break;
    }

    // ─── voltx start ──────────────────────────────────────────────────
    case "start": {
      const { runStart } = await import("./start.js");
      await runStart({
        port: parsePort(),
        outDir: parseFlag("--out-dir") ?? parseFlag("-o"),
        entry: parseFlag("--entry"),
      });
      break;
    }

    // ─── voltx generate ───────────────────────────────────────────────
    case "generate":
    case "g": {
      const type = args[1] as "route" | "agent" | "tool" | "job";
      const name = args[2];

      if (!type || !name) {
        console.error("[voltx] Usage: voltx generate <type> <name>");
        console.error("");
        console.error("  Types:");
        console.error("    route <path>    Generate a new API route     (e.g., api/users)");
        console.error("    agent <name>    Generate a new agent         (e.g., assistant)");
        console.error("    tool  <name>    Generate a new tool          (e.g., search)");
        console.error("    job   <name>    Generate a new background job (e.g., cleanup)");
        console.error("");
        console.error("  Options:");
        console.error("    --method <GET|POST|PUT|DELETE>   HTTP method for routes (default: POST)");
        process.exit(1);
      }

      const { runGenerate } = await import("./generate.js");
      await runGenerate({
        type,
        name,
        method: parseFlag("--method"),
      });
      break;
    }

    // ─── voltx --version ──────────────────────────────────────────────
    case "--version":
    case "-v": {
      const { CLI_VERSION } = await import("./index.js");
      console.log(`voltx v${CLI_VERSION}`);
      break;
    }

    // ─── voltx help / default ─────────────────────────────────────────
    case "help":
    case "--help":
    case "-h":
    default: {
      printHelp();
    }
  }
}

function printHelp(): void {
  console.log(`
  ⚡ voltx — The AI-first full-stack framework

  Usage:
    voltx <command> [options]

  Commands:
    create <name>              Create a new VoltX project
    dev                        Start the development server (hot reload)
    build                      Build for production
    start                      Start the production server
    generate <type> <name>     Generate routes, agents, tools, or jobs

  Create Options:
    --template <type>          Template: chatbot, rag-app, agent-app, blank (default)
    --auth <provider>          Auth: better-auth, jwt, none (default)

  Dev Options:
    --port, -p <number>        Port override
    --entry <file>             Custom entry file (default: src/index.ts)
    --no-clear                 Don't clear screen on restart

  Build Options:
    --entry <file>             Custom entry file
    --out-dir, -o <dir>        Output directory (default: dist)
    --no-minify                Skip minification
    --sourcemap                Generate source maps

  Start Options:
    --port, -p <number>        Port override
    --out-dir, -o <dir>        Build output directory (default: dist)
    --entry <file>             Entry file within output dir

  Generate Types:
    route <path>               API route      (e.g., voltx generate route api/users)
    agent <name>               Agent          (e.g., voltx generate agent assistant)
    tool  <name>               Tool           (e.g., voltx generate tool search)
    job   <name>               Background job (e.g., voltx generate job cleanup)

  Examples:
    voltx create my-app --template chatbot --auth jwt
    voltx dev --port 4000
    voltx build --sourcemap
    voltx start
    voltx generate route api/users --method GET
    voltx generate agent assistant
  `);
}

main().catch((err) => {
  console.error("[voltx] Fatal error:", err);
  process.exit(1);
});
