#!/usr/bin/env node
// @voltx/cli — non-interactive scaffolding (used by `voltx create <name>`)

import * as fs from "node:fs";
import * as path from "node:path";
import { printWelcomeBanner } from "./welcome.js";

export interface CreateProjectOptions {
  name: string;
  template?: "chatbot" | "rag-app" | "agent-app" | "blank";
  auth?: "better-auth" | "jwt" | "none";
}

const V = "^0.3.0";

const TEMPLATE_DEPS: Record<string, Record<string, string>> = {
  blank: { "@voltx/core": V, "@voltx/server": V },
  chatbot: { "@voltx/core": V, "@voltx/ai": V, "@voltx/server": V, "@voltx/memory": V },
  "rag-app": { "@voltx/core": V, "@voltx/ai": V, "@voltx/server": V, "@voltx/rag": V, "@voltx/db": V },
  "agent-app": { "@voltx/core": V, "@voltx/ai": V, "@voltx/server": V, "@voltx/agents": V, "@voltx/memory": V },
};

export async function createProject(options: CreateProjectOptions): Promise<void> {
  const { name, template = "blank", auth = "none" } = options;
  const targetDir = path.resolve(process.cwd(), name);

  if (fs.existsSync(targetDir)) {
    console.error(`[voltx] Directory "${name}" already exists.`);
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const provider = template === "rag-app" ? "openai" : "cerebras";
  const model = template === "rag-app" ? "gpt-4o" : "llama3.1-8b";
  const hasDb = template === "rag-app" || template === "agent-app" || auth === "better-auth";

  // package.json
  const deps: Record<string, string> = { ...(TEMPLATE_DEPS[template] ?? TEMPLATE_DEPS["blank"]), "@voltx/cli": V };
  if (auth === "better-auth") { deps["@voltx/auth"] = V; deps["better-auth"] = "^1.5.0"; }
  else if (auth === "jwt") { deps["@voltx/auth"] = V; deps["jose"] = "^6.0.0"; }

  fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify({
    name, version: "0.1.0", private: true,
    scripts: { dev: "voltx dev", build: "voltx build", start: "voltx start" },
    dependencies: deps,
    devDependencies: { typescript: "^5.7.0", tsx: "^4.21.0", tsup: "^8.0.0", "@types/node": "^22.0.0" },
  }, null, 2));

  // voltx.config.ts
  let config = `import { defineConfig } from "@voltx/core";\n\nexport default defineConfig({\n  name: "${name}",\n  port: 3000,\n  ai: {\n    provider: "${provider}",\n    model: "${model}",\n  },`;
  if (hasDb) config += `\n  db: {\n    url: process.env.DATABASE_URL,\n  },`;
  if (auth !== "none") config += `\n  auth: {\n    provider: "${auth}",\n  },`;
  config += `\n  server: {\n    routesDir: "src/routes",\n    staticDir: "public",\n    cors: true,\n  },\n});\n`;
  fs.writeFileSync(path.join(targetDir, "voltx.config.ts"), config);

  // Directories
  fs.mkdirSync(path.join(targetDir, "src", "routes", "api"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "public"), { recursive: true });

  // tsconfig.json
  fs.writeFileSync(path.join(targetDir, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true, esModuleInterop: true, skipLibCheck: true, outDir: "dist" },
    include: ["src", "voltx.config.ts"],
  }, null, 2));

  // src/index.ts
  fs.writeFileSync(path.join(targetDir, "src", "index.ts"),
    `import { createApp } from "@voltx/core";\nimport config from "../voltx.config";\n\nconst app = createApp(config);\napp.start();\n`);

  // src/routes/index.ts — health check
  fs.writeFileSync(path.join(targetDir, "src", "routes", "index.ts"),
    `// GET / — Health check\nimport type { Context } from "@voltx/server";\n\nexport function GET(c: Context) {\n  return c.json({ name: "${name}", status: "ok" });\n}\n`);

  // ── Chat route (chatbot + agent-app) ─────────────────────────────────────
  if (template === "chatbot" || template === "agent-app") {
    fs.writeFileSync(path.join(targetDir, "src", "routes", "api", "chat.ts"),
      `// POST /api/chat — Streaming chat with conversation memory
import type { Context } from "@voltx/server";
import { streamText } from "@voltx/ai";
import { createMemory } from "@voltx/memory";

const memory = createMemory({ maxMessages: 50 });

export async function POST(c: Context) {
  const { messages, conversationId = "default" } = await c.req.json();

  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    await memory.add(conversationId, { role: "user", content: lastMessage.content });
  }

  const history = await memory.get(conversationId);

  const result = await streamText({
    model: "${provider}:${model}",
    system: "You are a helpful AI assistant.",
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  result.text.then(async (text) => {
    await memory.add(conversationId, { role: "assistant", content: text });
  });

  return result.toSSEResponse();
}
`);
  }

  // ── Agent-specific files ─────────────────────────────────────────────────
  if (template === "agent-app") {
    fs.mkdirSync(path.join(targetDir, "src", "agents"), { recursive: true });
    fs.mkdirSync(path.join(targetDir, "src", "tools"), { recursive: true });

    // Default tools: calculator + datetime (no API keys needed)
    fs.writeFileSync(path.join(targetDir, "src", "tools", "calculator.ts"), `// Calculator tool — evaluates math expressions (no API key needed)
import type { Tool } from "@voltx/agents";

export const calculatorTool: Tool = {
  name: "calculator",
  description: "Evaluate a math expression. Supports +, -, *, /, %, parentheses, and Math functions.",
  parameters: {
    type: "object",
    properties: { expression: { type: "string", description: "The math expression to evaluate" } },
    required: ["expression"],
  },
  async execute(args: { expression: string }) {
    try {
      const safe = args.expression.replace(/[^0-9+\\-*/.()%\\s,]|(?<!Math)\\.[a-z]/gi, (match) => {
        if (args.expression.includes("Math.")) return match;
        throw new Error("Invalid character: " + match);
      });
      const result = new Function("return " + safe)();
      return \`\${args.expression} = \${result}\`;
    } catch (err) {
      return \`Error: \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`);

    fs.writeFileSync(path.join(targetDir, "src", "tools", "datetime.ts"), `// Date & time tool — returns current date, time, timezone (no API key needed)
import type { Tool } from "@voltx/agents";

export const datetimeTool: Tool = {
  name: "datetime",
  description: "Get the current date, time, day of week, and timezone.",
  parameters: {
    type: "object",
    properties: { timezone: { type: "string", description: "Optional IANA timezone. Defaults to server timezone." } },
  },
  async execute(args: { timezone?: string }) {
    const now = new Date();
    const tz = args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formatted = now.toLocaleString("en-US", {
      timeZone: tz, weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
    return \`Current date/time (\${tz}): \${formatted}\`;
  },
};
`);

    fs.writeFileSync(path.join(targetDir, "src", "agents", "assistant.ts"), `// AI Agent — autonomous assistant with tools
import { createAgent } from "@voltx/agents";
import { calculatorTool } from "../tools/calculator";
import { datetimeTool } from "../tools/datetime";

export const assistant = createAgent({
  name: "assistant",
  model: "${provider}:${model}",
  instructions: "You are a helpful AI assistant with access to tools: Calculator, Date & Time. Use them when needed to answer questions accurately.",
  tools: [calculatorTool, datetimeTool],
  maxIterations: 5,
});
`);

    fs.writeFileSync(path.join(targetDir, "src", "routes", "api", "agent.ts"),
      `// POST /api/agent — Run the AI agent\nimport type { Context } from "@voltx/server";\nimport { assistant } from "../../agents/assistant";\n\nexport async function POST(c: Context) {\n  const { input } = await c.req.json();\n  if (!input) return c.json({ error: "Missing 'input' field" }, 400);\n  const result = await assistant.run(input);\n  return c.json({ content: result.content, steps: result.steps });\n}\n`);
  }

  // ── RAG routes ─────────────────────────────────────────────────────────────
  if (template === "rag-app") {
    const embedModel = "openai:text-embedding-3-small";
    fs.mkdirSync(path.join(targetDir, "src", "routes", "api", "rag"), { recursive: true });

    fs.writeFileSync(path.join(targetDir, "src", "routes", "api", "rag", "query.ts"),
      `// POST /api/rag/query — Query documents with RAG
import type { Context } from "@voltx/server";
import { streamText } from "@voltx/ai";
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const vectorStore = createVectorStore();
const embedder = createEmbedder({ model: "${embedModel}" });
const rag = createRAGPipeline({ embedder, vectorStore });

export async function POST(c: Context) {
  const { question } = await c.req.json();
  const context = await rag.getContext(question, { topK: 5 });
  const result = await streamText({
    model: "${provider}:${model}",
    system: \`Answer based on context. If not relevant, say so.\\n\\nContext:\\n\${context}\`,
    messages: [{ role: "user", content: question }],
  });
  return result.toSSEResponse();
}
`);

    fs.writeFileSync(path.join(targetDir, "src", "routes", "api", "rag", "ingest.ts"),
      `// POST /api/rag/ingest — Ingest documents into the vector store
import type { Context } from "@voltx/server";
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const vectorStore = createVectorStore();
const embedder = createEmbedder({ model: "${embedModel}" });
const rag = createRAGPipeline({ embedder, vectorStore });

export async function POST(c: Context) {
  const { text, idPrefix } = await c.req.json();
  if (!text || typeof text !== "string") return c.json({ error: "Missing 'text' field" }, 400);
  const result = await rag.ingest(text, idPrefix ?? "doc");
  return c.json({ status: "ok", chunks: result.chunks, ids: result.ids });
}
`);
  }

  // ── Auth routes ────────────────────────────────────────────────────────────
  if (auth === "better-auth") {
    fs.mkdirSync(path.join(targetDir, "src", "routes", "api", "auth"), { recursive: true });
    fs.writeFileSync(path.join(targetDir, "src", "routes", "api", "auth", "[...path].ts"),
      `// ALL /api/auth/* — Better Auth handler\nimport type { Context } from "@voltx/server";\nimport { auth } from "../../../lib/auth";\nimport { createAuthHandler } from "@voltx/auth";\n\nconst handler = createAuthHandler(auth);\n\nexport const GET = (c: Context) => handler(c);\nexport const POST = (c: Context) => handler(c);\n`);
    fs.mkdirSync(path.join(targetDir, "src", "lib"), { recursive: true });
    fs.writeFileSync(path.join(targetDir, "src", "lib", "auth.ts"),
      `import { createAuth, createAuthMiddleware } from "@voltx/auth";\n\nexport const auth = createAuth("better-auth", {\n  database: process.env.DATABASE_URL!,\n  emailAndPassword: true,\n});\n\nexport const authMiddleware = createAuthMiddleware({\n  provider: auth,\n  publicPaths: ["/api/auth", "/api/health", "/"],\n});\n`);
  } else if (auth === "jwt") {
    fs.mkdirSync(path.join(targetDir, "src", "lib"), { recursive: true });
    fs.writeFileSync(path.join(targetDir, "src", "lib", "auth.ts"),
      `import { createAuth, createAuthMiddleware } from "@voltx/auth";\n\nexport const jwt = createAuth("jwt", {\n  secret: process.env.JWT_SECRET!,\n  expiresIn: "7d",\n});\n\nexport const authMiddleware = createAuthMiddleware({\n  provider: jwt,\n  publicPaths: ["/api/auth", "/api/health", "/"],\n});\n`);
    fs.writeFileSync(path.join(targetDir, "src", "routes", "api", "auth.ts"),
      `import type { Context } from "@voltx/server";\nimport { jwt } from "../../lib/auth";\n\nexport async function POST(c: Context) {\n  const { email, password } = await c.req.json();\n  if (!email || !password) return c.json({ error: "Email and password are required" }, 400);\n  const token = await jwt.sign({ sub: email, email });\n  return c.json({ token });\n}\n`);
  }

  // ── .env.example ───────────────────────────────────────────────────────────
  let envContent = "";
  if (template === "rag-app") {
    envContent += "# ─── LLM Provider ────────────────────────────────\nOPENAI_API_KEY=sk-...\n\n";
    envContent += "# ─── Database ────────────────────────────────────\nDATABASE_URL=\n\n";
  } else if (template === "chatbot" || template === "agent-app") {
    envContent += "# ─── LLM Provider ────────────────────────────────\nCEREBRAS_API_KEY=csk-...\n\n";
    if (template === "agent-app") {
      envContent += "# ─── Database (optional) ─────────────────────────\nDATABASE_URL=\n\n";
      envContent += "# ─── Tool API Keys (add keys for tools you use) ──\n";
      envContent += "# TAVILY_API_KEY=tvly-...       (Web Search — https://tavily.com)\n";
      envContent += "# SERPER_API_KEY=               (Google Search — https://serper.dev)\n";
      envContent += "# OPENWEATHER_API_KEY=          (Weather — https://openweathermap.org/api)\n";
      envContent += "# NEWS_API_KEY=                 (News — https://newsapi.org)\n\n";
    }
  } else {
    envContent += "# ─── LLM Provider ────────────────────────────────\n# OPENAI_API_KEY=sk-...\n# CEREBRAS_API_KEY=csk-...\n\n";
  }
  if (auth === "better-auth") {
    envContent += "# ─── Auth (Better Auth) ──────────────────────────\nBETTER_AUTH_SECRET=your-secret-key-min-32-chars-here\nBETTER_AUTH_URL=http://localhost:3000\n\n";
  } else if (auth === "jwt") {
    envContent += "# ─── Auth (JWT) ──────────────────────────────────\nJWT_SECRET=your-jwt-secret-key\n\n";
  }
  envContent += "# ─── App ─────────────────────────────────────────\nPORT=3000\nNODE_ENV=development\n";
  fs.writeFileSync(path.join(targetDir, ".env.example"), envContent);

  // .gitignore
  fs.writeFileSync(path.join(targetDir, ".gitignore"), "node_modules\ndist\n.env\n");

  // tsconfig already written above

  // Show the welcome banner
  printWelcomeBanner(name);
}

// CLI entry point — only runs when invoked directly
const isDirectRun =
  typeof require !== "undefined" &&
  require.main === module &&
  process.argv[1]?.includes("create");

if (isDirectRun) {
  const projectName = process.argv[2];
  if (!projectName) {
    console.log("Usage: create-voltx-app <project-name> [--template chatbot] [--auth jwt]");
    process.exit(1);
  }

  const templateFlag = process.argv.indexOf("--template");
  const template = templateFlag !== -1
    ? (process.argv[templateFlag + 1] as CreateProjectOptions["template"])
    : "blank";

  const authFlag = process.argv.indexOf("--auth");
  const auth = authFlag !== -1
    ? (process.argv[authFlag + 1] as CreateProjectOptions["auth"])
    : "none";

  createProject({ name: projectName, template, auth }).catch((err) => {
    console.error("[voltx] Error:", err);
    process.exit(1);
  });
}
