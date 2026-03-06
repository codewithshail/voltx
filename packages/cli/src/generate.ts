// @voltx/cli — Code generator
// Scaffolds routes, agents, tools, and jobs from templates.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

export type GeneratorType = "route" | "agent" | "tool" | "job";

export interface GenerateOptions {
  type: GeneratorType;
  name: string;
  /** HTTP method for routes (default: POST) */
  method?: string;
}

/**
 * Generate a new file from a template.
 */
export async function runGenerate(options: GenerateOptions): Promise<void> {
  const cwd = process.cwd();
  const { type, name } = options;

  switch (type) {
    case "route":
      generateRoute(cwd, name, options.method);
      break;
    case "agent":
      generateAgent(cwd, name);
      break;
    case "tool":
      generateTool(cwd, name);
      break;
    case "job":
      generateJob(cwd, name);
      break;
    default:
      console.error(`[voltx] Unknown generator type: ${type}`);
      console.error("[voltx] Available: route, agent, tool, job");
      process.exit(1);
  }
}

// ─── Route Generator ─────────────────────────────────────────────────────────

function generateRoute(cwd: string, name: string, method = "POST"): void {
  // name can be "api/users" or "api/chat" or just "health"
  const routePath = name.startsWith("/") ? name.slice(1) : name;
  const filePath = join(cwd, "src", "routes", `${routePath}.ts`);

  if (existsSync(filePath)) {
    console.error(`[voltx] Route already exists: src/routes/${routePath}.ts`);
    process.exit(1);
  }

  const upperMethod = method.toUpperCase();
  const urlPath = "/" + routePath;

  const content = `// ${upperMethod} ${urlPath}
import type { Context } from "@voltx/server";

export async function ${upperMethod}(c: Context) {
  return c.json({ message: "Hello from ${urlPath}" });
}
`;

  writeFileSafe(filePath, content);
  console.log(`  ✓ Created route: src/routes/${routePath}.ts`);
  console.log(`    ${upperMethod} ${urlPath}`);
}

// ─── Agent Generator ─────────────────────────────────────────────────────────

function generateAgent(cwd: string, name: string): void {
  const filePath = join(cwd, "src", "agents", `${name}.ts`);

  if (existsSync(filePath)) {
    console.error(`[voltx] Agent already exists: src/agents/${name}.ts`);
    process.exit(1);
  }

  const content = `// Agent: ${name}
import { createAgent } from "@voltx/agents";

export const ${toCamelCase(name)} = createAgent({
  name: "${name}",
  model: "cerebras:llama3.1-8b",
  instructions: "You are a helpful AI assistant named ${name}.",
  tools: [
    // Add tools here:
    // {
    //   name: "example",
    //   description: "An example tool",
    //   parameters: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
    //   execute: async (params) => \`Processed: \${params.input}\`,
    // },
  ],
});
`;

  writeFileSafe(filePath, content);
  console.log(`  ✓ Created agent: src/agents/${name}.ts`);
}

// ─── Tool Generator ──────────────────────────────────────────────────────────

function generateTool(cwd: string, name: string): void {
  const filePath = join(cwd, "src", "tools", `${name}.ts`);

  if (existsSync(filePath)) {
    console.error(`[voltx] Tool already exists: src/tools/${name}.ts`);
    process.exit(1);
  }

  const content = `// Tool: ${name}

export const ${toCamelCase(name)}Tool = {
  name: "${name}",
  description: "TODO: Describe what this tool does",
  parameters: {
    type: "object" as const,
    properties: {
      input: { type: "string", description: "The input to process" },
    },
    required: ["input"],
  },
  execute: async (params: { input: string }): Promise<string> => {
    // TODO: Implement tool logic
    return \`${name} result for: \${params.input}\`;
  },
};
`;

  writeFileSafe(filePath, content);
  console.log(`  ✓ Created tool: src/tools/${name}.ts`);
}

// ─── Job Generator ───────────────────────────────────────────────────────────

function generateJob(cwd: string, name: string): void {
  const filePath = join(cwd, "src", "jobs", `${name}.ts`);

  if (existsSync(filePath)) {
    console.error(`[voltx] Job already exists: src/jobs/${name}.ts`);
    process.exit(1);
  }

  const content = `// Job: ${name}
// Runs on a schedule or triggered via ctx.jobs.enqueue("${name}", data)

export const config = {
  // Cron schedule (uncomment to enable):
  // schedule: "0 */6 * * *",  // every 6 hours
  //
  // Or make it a queue job (triggered on-demand):
  queue: true,
  retries: 3,
  timeout: "5m",
};

export async function run(ctx: any, data?: Record<string, unknown>) {
  console.log("[job:${name}] Running...", data);

  // TODO: Implement job logic

  console.log("[job:${name}] Done.");
}
`;

  writeFileSafe(filePath, content);
  console.log(`  ✓ Created job: src/jobs/${name}.ts`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function writeFileSafe(filePath: string, content: string): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

function toCamelCase(str: string): string {
  return str
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toLowerCase());
}
