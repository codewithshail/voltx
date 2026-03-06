#!/usr/bin/env node
// @voltx/cli — create-voltx-app scaffolding

import * as fs from "node:fs";
import * as path from "node:path";
import { printWelcomeBanner } from "./welcome.js";

export interface CreateProjectOptions {
  name: string;
  template?: "chatbot" | "rag-app" | "agent-app" | "blank";
  auth?: "better-auth" | "jwt" | "none";
}

export async function createProject(
  options: CreateProjectOptions
): Promise<void> {
  const { name, template = "blank", auth = "none" } = options;
  const targetDir = path.resolve(process.cwd(), name);

  if (fs.existsSync(targetDir)) {
    console.error(`[voltx] Directory "${name}" already exists.`);
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  // Determine dependencies based on template
  const templateDeps: Record<string, Record<string, string>> = {
    blank: {
      "@voltx/core": "^0.3.0",
      "@voltx/server": "^0.3.0",
    },
    chatbot: {
      "@voltx/core": "^0.3.0",
      "@voltx/ai": "^0.3.0",
      "@voltx/server": "^0.3.0",
      "@voltx/memory": "^0.3.0",
    },
    "rag-app": {
      "@voltx/core": "^0.3.0",
      "@voltx/ai": "^0.3.0",
      "@voltx/server": "^0.3.0",
      "@voltx/rag": "^0.3.0",
      "@voltx/db": "^0.3.0",
    },
    "agent-app": {
      "@voltx/core": "^0.3.0",
      "@voltx/ai": "^0.3.0",
      "@voltx/server": "^0.3.0",
      "@voltx/agents": "^0.3.0",
      "@voltx/memory": "^0.3.0",
    },
  };

  const packageJson = {
    name,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "voltx dev",
      build: "voltx build",
      start: "voltx start",
    },
    dependencies: {
      ...(templateDeps[template] ?? templateDeps["blank"]),
      "@voltx/cli": "^0.3.0",
      ...(auth === "better-auth" ? { "@voltx/auth": "^0.3.0", "better-auth": "^1.5.0" } : {}),
      ...(auth === "jwt" ? { "@voltx/auth": "^0.3.0", "jose": "^6.0.0" } : {}),
    },
    devDependencies: {
      typescript: "^5.7.0",
      tsx: "^4.21.0",
      tsup: "^8.0.0",
      "@types/node": "^22.0.0",
    },
  };

  fs.writeFileSync(
    path.join(targetDir, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );

  // Create voltx.config.ts — template-specific
  const hasDb = template === "rag-app" || template === "agent-app" || auth === "better-auth";
  const provider = template === "rag-app" ? "openai" : "cerebras";
  const model = template === "rag-app" ? "gpt-4o" : "llama3.1-8b";

  let configContent = `import { defineConfig } from "@voltx/core";

export default defineConfig({
  name: "${name}",
  port: 3000,
  ai: {
    provider: "${provider}",
    model: "${model}",
  },`;

  if (hasDb) {
    configContent += `\n  db: {\n    url: process.env.DATABASE_URL,\n  },`;
  }

  if (auth !== "none") {
    configContent += `\n  auth: {\n    provider: "${auth}",\n  },`;
  }

  configContent += `\n  server: {\n    routesDir: "src/routes",\n    staticDir: "public",\n    cors: true,\n  },\n});\n`;

  fs.writeFileSync(path.join(targetDir, "voltx.config.ts"), configContent);

  // Create directory structure with routes
  fs.mkdirSync(path.join(targetDir, "src", "routes", "api"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "public"), { recursive: true });

  // src/index.ts — entry point
  fs.writeFileSync(
    path.join(targetDir, "src", "index.ts"),
    `import { createApp } from "@voltx/core";\nimport config from "../voltx.config";\n\nconst app = createApp(config);\napp.start();\n`
  );

  // src/routes/index.ts — health check
  fs.writeFileSync(
    path.join(targetDir, "src", "routes", "index.ts"),
    `// GET / — Health check\nimport type { Context } from "@voltx/server";\n\nexport function GET(c: Context) {\n  return c.json({ name: "${name}", status: "ok" });\n}\n`
  );

  // Template-specific route files
  if (template === "chatbot" || template === "agent-app") {
    fs.writeFileSync(
      path.join(targetDir, "src", "routes", "api", "chat.ts"),
      `// POST /api/chat — Streaming chat with conversation memory
import type { Context } from "@voltx/server";
import { streamText } from "@voltx/ai";
import { createMemory } from "@voltx/memory";

// In-memory for dev; swap to createMemory("postgres", { url }) for production
const memory = createMemory({ maxMessages: 50 });

export async function POST(c: Context) {
  const { messages, conversationId = "default" } = await c.req.json();

  // Store the latest user message
  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    await memory.add(conversationId, { role: "user", content: lastMessage.content });
  }

  // Get conversation history from memory
  const history = await memory.get(conversationId);

  const result = await streamText({
    model: "${provider}:${model}",
    system: "You are a helpful AI assistant.",
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  // Store assistant response after stream completes
  result.text.then(async (text) => {
    await memory.add(conversationId, { role: "assistant", content: text });
  });

  return result.toSSEResponse();
}
`
    );
  }

  // Agent-specific files
  if (template === "agent-app") {
    fs.mkdirSync(path.join(targetDir, "src", "agents"), { recursive: true });
    fs.mkdirSync(path.join(targetDir, "src", "tools"), { recursive: true });

    // Default tools for non-interactive CLI: calculator + datetime (no API keys needed)
    fs.writeFileSync(
      path.join(targetDir, "src", "tools", "calculator.ts"),
      `// Calculator tool — evaluates math expressions (no API key needed)
import type { Tool } from "@voltx/agents";

export const calculatorTool: Tool = {
  name: "calculator",
  description: "Evaluate a math expression. Supports +, -, *, /, %, parentheses, and Math functions like Math.sqrt(), Math.pow(), Math.round().",
  parameters: {
    type: "object",
    properties: {
      expression: { type: "string", description: "The math expression to evaluate, e.g. '(15 * 85) / 100'" },
    },
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
      return \`Error evaluating "\${args.expression}": \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`
    );

    fs.writeFileSync(
      path.join(targetDir, "src", "tools", "datetime.ts"),
      `// Date & time tool — returns current date, time, timezone (no API key needed)
import type { Tool } from "@voltx/agents";

export const datetimeTool: Tool = {
  name: "datetime",
  description: "Get the current date, time, day of week, and timezone. Use this when the user asks about the current date or time.",
  parameters: {
    type: "object",
    properties: {
      timezone: { type: "string", description: "Optional IANA timezone like 'America/New_York' or 'Asia/Kolkata'. Defaults to server timezone." },
    },
  },
  async execute(args: { timezone?: string }) {
    const now = new Date();
    const tz = args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formatted = now.toLocaleString("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    return \`Current date/time (\${tz}): \${formatted}\`;
  },
};
`
    );

    fs.writeFileSync(
      path.join(targetDir, "src", "agents", "assistant.ts"),
      `// AI Agent — autonomous assistant with tools
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
`
    );

    fs.writeFileSync(
      path.join(targetDir, "src", "routes", "api", "agent.ts"),
      `import type { Context } from "@voltx/server";
import { assistant } from "../../agents/assistant";

export async function POST(c: Context) {
  const { input } = await c.req.json();
  if (!input) return c.json({ error: "Missing 'input' field" }, 400);
  const result = await assistant.run(input);
  return c.json({ content: result.content, steps: result.steps });
}
`
    );
  }

  if (template === "rag-app") {
    // RAG uses openai for embeddings by default (most providers don't support embeddings)
    const embedModel = "openai:text-embedding-3-small";

    fs.mkdirSync(path.join(targetDir, "src", "routes", "api", "rag"), { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "src", "routes", "api", "rag", "query.ts"),
      `// POST /api/rag/query — Query documents with RAG
import type { Context } from "@voltx/server";
import { streamText } from "@voltx/ai";
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const vectorStore = createVectorStore(); // swap to "pinecone" or "pgvector" for production
const embedder = createEmbedder({ model: "${embedModel}" });
const rag = createRAGPipeline({ embedder, vectorStore });

export async function POST(c: Context) {
  const { question } = await c.req.json();

  const context = await rag.getContext(question, { topK: 5 });

  const result = await streamText({
    model: "${provider}:${model}",
    system: \`Answer the user's question based on the following context. If the context doesn't contain relevant information, say so.\\n\\nContext:\\n\${context}\`,
    messages: [{ role: "user", content: question }],
  });

  return result.toSSEResponse();
}
`
    );
    fs.writeFileSync(
      path.join(targetDir, "src", "routes", "api", "rag", "ingest.ts"),
      `// POST /api/rag/ingest — Ingest documents into the vector store
import type { Context } from "@voltx/server";
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const vectorStore = createVectorStore();
const embedder = createEmbedder({ model: "${embedModel}" });
const rag = createRAGPipeline({ embedder, vectorStore });

export async function POST(c: Context) {
  const { text, idPrefix } = await c.req.json();

  if (!text || typeof text !== "string") {
    return c.json({ error: "Missing 'text' field" }, 400);
  }

  const result = await rag.ingest(text, idPrefix ?? "doc");
  return c.json({ status: "ok", chunks: result.chunks, ids: result.ids });
}
`
    );
  }

  // Auth route files
  if (auth === "better-auth") {
    // Better Auth needs a catch-all route at /api/auth/* for sign-up, sign-in, OAuth, etc.
    fs.mkdirSync(path.join(targetDir, "src", "routes", "api", "auth"), { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "src", "routes", "api", "auth", "[...path].ts"),
      `// ALL /api/auth/* — Better Auth handler
import type { Context } from "@voltx/server";
import { auth } from "../../../lib/auth";
import { createAuthHandler } from "@voltx/auth";

const handler = createAuthHandler(auth);

export const GET = (c: Context) => handler(c);
export const POST = (c: Context) => handler(c);
`
    );
    fs.mkdirSync(path.join(targetDir, "src", "lib"), { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "src", "lib", "auth.ts"),
      `// Auth configuration — Better Auth with DB-backed sessions
import { createAuth, createAuthMiddleware } from "@voltx/auth";

export const auth = createAuth("better-auth", {
  database: process.env.DATABASE_URL!,
  emailAndPassword: true,
});

export const authMiddleware = createAuthMiddleware({
  provider: auth,
  publicPaths: ["/api/auth", "/api/health", "/"],
});
`
    );
  } else if (auth === "jwt") {
    fs.mkdirSync(path.join(targetDir, "src", "lib"), { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "src", "lib", "auth.ts"),
      `// Auth configuration — JWT (stateless)
import { createAuth, createAuthMiddleware } from "@voltx/auth";

export const jwt = createAuth("jwt", {
  secret: process.env.JWT_SECRET!,
  expiresIn: "7d",
});

export const authMiddleware = createAuthMiddleware({
  provider: jwt,
  publicPaths: ["/api/auth", "/api/health", "/"],
});
`
    );
    fs.writeFileSync(
      path.join(targetDir, "src", "routes", "api", "auth.ts"),
      `// POST /api/auth/login — Example JWT login route
import type { Context } from "@voltx/server";
import { jwt } from "../../lib/auth";

export async function POST(c: Context) {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const token = await jwt.sign({ sub: email, email });
  return c.json({ token });
}
`
    );
  }

  // .env.example — template-specific
  let envContent = "";
  if (template === "rag-app") {
    envContent += "# ─── LLM Provider ────────────────────────────────\nOPENAI_API_KEY=sk-...\n\n";
    envContent += "# ─── Database (Neon Postgres) ────────────────────\nDATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require\n\n";
    envContent += "# ─── Vector Database (Pinecone) ──────────────────\nPINECONE_API_KEY=pc-...\nPINECONE_INDEX=voltx-embeddings\n\n";
  } else if (template === "chatbot" || template === "agent-app") {
    envContent += "# ─── LLM Provider ────────────────────────────────\nCEREBRAS_API_KEY=csk-...\n\n";
    if (template === "agent-app") {
      envContent += "# ─── Database (Neon Postgres — optional) ─────────\nDATABASE_URL=\n\n";
      envContent += "# ─── Tool API Keys (add keys for tools you use) ──\n";
      envContent += "# TAVILY_API_KEY=tvly-...       (Web Search — https://tavily.com)\n";
      envContent += "# SERPER_API_KEY=               (Google Search — https://serper.dev)\n";
      envContent += "# OPENWEATHER_API_KEY=          (Weather — https://openweathermap.org/api)\n";
      envContent += "# NEWS_API_KEY=                 (News — https://newsapi.org)\n\n";
    }
  } else {
    envContent += "# ─── LLM Provider (add your key) ─────────────────\n# OPENAI_API_KEY=sk-...\n# CEREBRAS_API_KEY=csk-...\n\n";
  }

  // Auth env vars
  if (auth === "better-auth") {
    envContent += "# ─── Auth (Better Auth) ──────────────────────────\nBETTER_AUTH_SECRET=your-secret-key-min-32-chars-here\nBETTER_AUTH_URL=http://localhost:3000\n";
    if (template !== "rag-app" && template !== "agent-app") {
      envContent += "DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require\n";
    }
    envContent += "# GITHUB_CLIENT_ID=\n# GITHUB_CLIENT_SECRET=\n\n";
  } else if (auth === "jwt") {
    envContent += "# ─── Auth (JWT) ──────────────────────────────────\nJWT_SECRET=your-jwt-secret-key\n\n";
  }

  envContent += "# ─── App ─────────────────────────────────────────\nPORT=3000\nNODE_ENV=development\n";
  fs.writeFileSync(path.join(targetDir, ".env.example"), envContent);

  // .gitignore
  fs.writeFileSync(
    path.join(targetDir, ".gitignore"),
    "node_modules\ndist\n.env\n"
  );

  // tsconfig.json
  fs.writeFileSync(
    path.join(targetDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          outDir: "dist",
        },
        include: ["src", "voltx.config.ts"],
      },
      null,
      2
    )
  );

  // Show the welcome banner
  printWelcomeBanner(name);
}

// CLI entry point — only runs when invoked directly as create-voltx-app
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
  const template =
    templateFlag !== -1
      ? (process.argv[templateFlag + 1] as CreateProjectOptions["template"])
      : "blank";

  const authFlag = process.argv.indexOf("--auth");
  const auth =
    authFlag !== -1
      ? (process.argv[authFlag + 1] as CreateProjectOptions["auth"])
      : "none";

  createProject({ name: projectName, template, auth }).catch((err) => {
    console.error("[voltx] Error:", err);
    process.exit(1);
  });
}
