#!/usr/bin/env node
// @voltx/cli — non-interactive scaffolding (used by `voltx create <name>`)

import * as fs from "node:fs";
import * as path from "node:path";
import { printWelcomeBanner } from "./welcome.js";

export interface CreateProjectOptions {
  name: string;
  template?: "chatbot" | "rag-app" | "agent-app" | "blank";
  auth?: "better-auth" | "jwt" | "none";
  shadcn?: boolean;
}

const VV: Record<string, string> = {
  "@voltx/core": "^0.3.2",
  "@voltx/server": "^0.3.2",
  "@voltx/cli": "^0.3.7",
  "@voltx/ai": "^0.3.0",
  "@voltx/agents": "^0.3.1",
  "@voltx/memory": "^0.3.0",
  "@voltx/db": "^0.3.0",
  "@voltx/rag": "^0.3.1",
  "@voltx/auth": "^0.3.0",
};

function v(pkg: string): string { return VV[pkg] ?? "^0.3.0"; }

const TEMPLATE_DEPS: Record<string, Record<string, string>> = {
  blank: { "@voltx/core": v("@voltx/core"), "@voltx/server": v("@voltx/server") },
  chatbot: { "@voltx/core": v("@voltx/core"), "@voltx/ai": v("@voltx/ai"), "@voltx/server": v("@voltx/server"), "@voltx/memory": v("@voltx/memory") },
  "rag-app": { "@voltx/core": v("@voltx/core"), "@voltx/ai": v("@voltx/ai"), "@voltx/server": v("@voltx/server"), "@voltx/rag": v("@voltx/rag"), "@voltx/db": v("@voltx/db") },
  "agent-app": { "@voltx/core": v("@voltx/core"), "@voltx/ai": v("@voltx/ai"), "@voltx/server": v("@voltx/server"), "@voltx/agents": v("@voltx/agents"), "@voltx/memory": v("@voltx/memory") },
};

export async function createProject(options: CreateProjectOptions): Promise<void> {
  const { name, template = "blank", auth = "none", shadcn = false } = options;
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
  const deps: Record<string, string> = { ...(TEMPLATE_DEPS[template] ?? TEMPLATE_DEPS["blank"]), "@voltx/cli": v("@voltx/cli") };
  if (auth === "better-auth") { deps["@voltx/auth"] = v("@voltx/auth"); deps["better-auth"] = "^1.5.0"; }
  else if (auth === "jwt") { deps["@voltx/auth"] = v("@voltx/auth"); deps["jose"] = "^6.0.0"; }

  const devDeps: Record<string, string> = { typescript: "^5.7.0", tsx: "^4.21.0", tsup: "^8.0.0", "@types/node": "^22.0.0" };
  deps["hono"] = "^4.7.0";
  deps["@hono/node-server"] = "^1.14.0";
  deps["react"] = "^19.0.0";
  deps["react-dom"] = "^19.0.0";
  deps["tailwindcss"] = "^4.0.0";
  devDeps["vite"] = "^6.0.0";
  devDeps["@hono/vite-dev-server"] = "^0.7.0";
  devDeps["@vitejs/plugin-react"] = "^4.3.0";
  devDeps["@tailwindcss/vite"] = "^4.0.0";
  devDeps["@types/react"] = "^19.0.0";
  devDeps["@types/react-dom"] = "^19.0.0";

  // shadcn/ui base deps
  if (shadcn) {
    deps["class-variance-authority"] = "^0.7.0";
    deps["clsx"] = "^2.1.0";
    deps["tailwind-merge"] = "^3.0.0";
    deps["lucide-react"] = "^0.468.0";
  }

  // @voltx/cli is a dev tool — move it to devDependencies so the bin links correctly
  devDeps["@voltx/cli"] = deps["@voltx/cli"] ?? v("@voltx/cli");
  delete deps["@voltx/cli"];

  fs.writeFileSync(path.join(targetDir, "package.json"), JSON.stringify({
    name, version: "0.1.0", private: true,
    scripts: { dev: "npx voltx dev", build: "npx voltx build", start: "npx voltx start" },
    dependencies: deps,
    devDependencies: devDeps,
  }, null, 2));

  // voltx.config.ts
  let config = `import { defineConfig } from "@voltx/core";\n\nexport default defineConfig({\n  name: "${name}",\n  port: 3000,\n  ai: {\n    provider: "${provider}",\n    model: "${model}",\n  },`;
  if (hasDb) config += `\n  db: {\n    url: process.env.DATABASE_URL,\n  },`;
  if (auth !== "none") config += `\n  auth: {\n    provider: "${auth}",\n  },`;
  config += `\n  server: {\n    routesDir: "api",\n    staticDir: "public",\n    cors: true,\n  },\n});\n`;
  fs.writeFileSync(path.join(targetDir, "voltx.config.ts"), config);

  // Directories
  fs.mkdirSync(path.join(targetDir, "api"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "public"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src", "components"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src", "hooks"), { recursive: true });
  fs.mkdirSync(path.join(targetDir, "src", "lib"), { recursive: true });

  // Public assets
  fs.writeFileSync(path.join(targetDir, "public", "favicon.svg"), generateFaviconSVG());
  fs.writeFileSync(path.join(targetDir, "public", "robots.txt"), generateRobotsTxt());
  fs.writeFileSync(path.join(targetDir, "public", "site.webmanifest"), generateWebManifest(name));

  // tsconfig.json
  const tsconfig: Record<string, unknown> = {
    compilerOptions: {
      target: "ES2022", module: "ESNext", moduleResolution: "bundler",
      strict: true, esModuleInterop: true, skipLibCheck: true, outDir: "dist",
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
      jsx: "react-jsx",
    },
    include: ["src", "api", "server.ts", "voltx.config.ts"],
  };
  if (template === "agent-app") (tsconfig.include as string[]).push("agents", "tools");
  fs.writeFileSync(path.join(targetDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

  // server.ts — Hono app entry
  fs.writeFileSync(path.join(targetDir, "server.ts"), generateServerEntry(name, template));

  // vite.config.ts
  fs.writeFileSync(path.join(targetDir, "vite.config.ts"), generateViteConfigFile("server.ts"));

  // src/entry-client.tsx
  fs.writeFileSync(path.join(targetDir, "src", "entry-client.tsx"), generateEntryClient());

  // src/entry-server.tsx
  fs.writeFileSync(path.join(targetDir, "src", "entry-server.tsx"), generateEntryServer());

  // src/layout.tsx
  fs.writeFileSync(path.join(targetDir, "src", "layout.tsx"), generateLayoutComponent(name));

  // src/globals.css
  fs.writeFileSync(path.join(targetDir, "src", "globals.css"), generateGlobalCSS(shadcn));

  // shadcn/ui setup
  if (shadcn) {
    fs.writeFileSync(path.join(targetDir, "src", "lib", "utils.ts"), generateCnUtil());
    fs.writeFileSync(path.join(targetDir, "components.json"), generateComponentsJson());
  }

  // src/app.tsx
  fs.writeFileSync(path.join(targetDir, "src", "app.tsx"), generateAppComponent(name, template));

  // api/index.ts — health check
  fs.writeFileSync(path.join(targetDir, "api", "index.ts"),
    `// GET /api — Health check\nimport type { Context } from "@voltx/server";\n\nexport function GET(c: Context) {\n  return c.json({ name: "${name}", status: "ok" });\n}\n`);

  // ── Chat route (chatbot + agent-app) ─────────────────────────────────────
  if (template === "chatbot" || template === "agent-app") {
    fs.writeFileSync(path.join(targetDir, "api", "chat.ts"),
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
    fs.mkdirSync(path.join(targetDir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(targetDir, "tools"), { recursive: true });

    fs.writeFileSync(path.join(targetDir, "tools", "calculator.ts"), `// Calculator tool — evaluates math expressions (no API key needed)
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

    fs.writeFileSync(path.join(targetDir, "tools", "datetime.ts"), `// Date & time tool — returns current date, time, timezone (no API key needed)
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

    fs.writeFileSync(path.join(targetDir, "agents", "assistant.ts"), `// AI Agent — autonomous assistant with tools
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

    fs.writeFileSync(path.join(targetDir, "api", "agent.ts"),
      `// POST /api/agent — Run the AI agent\nimport type { Context } from "@voltx/server";\nimport { assistant } from "../agents/assistant";\n\nexport async function POST(c: Context) {\n  const { input } = await c.req.json();\n  if (!input) return c.json({ error: "Missing 'input' field" }, 400);\n  const result = await assistant.run(input);\n  return c.json({ content: result.content, steps: result.steps });\n}\n`);
  }

  // ── RAG routes ─────────────────────────────────────────────────────────────
  if (template === "rag-app") {
    const embedModel = "openai:text-embedding-3-small";
    fs.mkdirSync(path.join(targetDir, "api", "rag"), { recursive: true });

    fs.writeFileSync(path.join(targetDir, "api", "rag", "query.ts"),
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

    fs.writeFileSync(path.join(targetDir, "api", "rag", "ingest.ts"),
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
    fs.mkdirSync(path.join(targetDir, "api", "auth"), { recursive: true });
    fs.writeFileSync(path.join(targetDir, "api", "auth", "[...path].ts"),
      `// ALL /api/auth/* — Better Auth handler\nimport type { Context } from "@voltx/server";\nimport { auth } from "../../src/lib/auth";\nimport { createAuthHandler } from "@voltx/auth";\n\nconst handler = createAuthHandler(auth);\n\nexport const GET = (c: Context) => handler(c);\nexport const POST = (c: Context) => handler(c);\n`);
    fs.writeFileSync(path.join(targetDir, "src", "lib", "auth.ts"),
      `import { createAuth, createAuthMiddleware } from "@voltx/auth";\n\nexport const auth = createAuth("better-auth", {\n  database: process.env.DATABASE_URL!,\n  emailAndPassword: true,\n});\n\nexport const authMiddleware = createAuthMiddleware({\n  provider: auth,\n  publicPaths: ["/api/auth", "/api/health", "/"],\n});\n`);
  } else if (auth === "jwt") {
    fs.writeFileSync(path.join(targetDir, "src", "lib", "auth.ts"),
      `import { createAuth, createAuthMiddleware } from "@voltx/auth";\n\nexport const jwt = createAuth("jwt", {\n  secret: process.env.JWT_SECRET!,\n  expiresIn: "7d",\n});\n\nexport const authMiddleware = createAuthMiddleware({\n  provider: jwt,\n  publicPaths: ["/api/auth", "/api/health", "/"],\n});\n`);
    fs.writeFileSync(path.join(targetDir, "api", "auth.ts"),
      `import type { Context } from "@voltx/server";\nimport { jwt } from "../src/lib/auth";\n\nexport async function POST(c: Context) {\n  const { email, password } = await c.req.json();\n  if (!email || !password) return c.json({ error: "Email and password are required" }, 400);\n  const token = await jwt.sign({ sub: email, email });\n  return c.json({ token });\n}\n`);
  }

  // ── .env.example ───────────────────────────────────────────────────────────
  let envContent = "";
  if (template === "rag-app") {
    envContent += "# ─── LLM Provider ────────────────────────────────\nOPENAI_API_KEY=sk-...\n\n";
    envContent += "# ─── Database ────────────────────────────────────\nDATABASE_URL=\n\n";
  } else if (template === "chatbot" || template === "agent-app") {
    envContent += "# ─── LLM Provider ────────────────────────────────\nCEREBRAS_API_KEY=csk-...\n\n";
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
  fs.writeFileSync(path.join(targetDir, ".gitignore"), "node_modules\ndist\n.env\n.env.local\n.env.*.local\nvite.config.voltx.ts\n");

  // Show the welcome banner
  printWelcomeBanner(name);
}

// ─── Server entry generator ──────────────────────────────────────────────────

function generateServerEntry(projectName: string, template: string): string {
  const imports: string[] = [];
  const mounts: string[] = [];

  imports.push('import { GET as healthGET } from "./api/index";');
  mounts.push('app.get("/api", healthGET);');

  if (template === "chatbot" || template === "agent-app") {
    imports.push('import { POST as chatPOST } from "./api/chat";');
    mounts.push('app.post("/api/chat", chatPOST);');
  }
  if (template === "agent-app") {
    imports.push('import { POST as agentPOST } from "./api/agent";');
    mounts.push('app.post("/api/agent", agentPOST);');
  }
  if (template === "rag-app") {
    imports.push('import { POST as ragQueryPOST } from "./api/rag/query";');
    imports.push('import { POST as ragIngestPOST } from "./api/rag/ingest";');
    mounts.push('app.post("/api/rag/query", ragQueryPOST);');
    mounts.push('app.post("/api/rag/ingest", ragIngestPOST);');
  }

  return `import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { registerSSR } from "@voltx/server";
import { loadEnv } from "@voltx/core";
${imports.join("\n")}

loadEnv(process.env.NODE_ENV ?? "development");

const isProd = process.env.NODE_ENV === "production";
const app = new Hono();

// ── API Routes ───────────────────────────────────────────────────────────
${mounts.join("\n")}

// ── Static assets (production) ───────────────────────────────────────────
if (isProd) {
  app.use("/assets/*", serveStatic({ root: "./dist/client/" }));
  app.use("/favicon.svg", serveStatic({ root: "./public/" }));
  app.use("/robots.txt", serveStatic({ root: "./public/" }));
  app.use("/site.webmanifest", serveStatic({ root: "./public/" }));
}

// ── SSR catch-all — renders React on the server ─────────────────────────
registerSSR(app, null, {
  title: "${projectName}",
  entryServer: "src/entry-server.tsx",
  entryClient: "src/entry-client.tsx",
  loadModule: (path) => import(/* @vite-ignore */ path),
});

export default app;

if (isProd) {
  const port = Number(process.env.PORT) || 3000;
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(\`\\n  ⚡ ${projectName} running at http://localhost:\${info.port}\\n\`);
  });
}
`;
}

// ─── Vite config generator ───────────────────────────────────────────────────

function generateViteConfigFile(entry: string): string {
  return `import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    devServer({
      entry: "${entry}",
      exclude: [
        /.*\\.tsx?($|\\?)/,
        /.*\\.(s?css|less)($|\\?)/,
        /.*\\.(svg|png|jpg|jpeg|gif|webp|ico)($|\\?)/,
        /^\\/@.+$/,
        /^\\/favicon\\.svg$/,
        /^\\/node_modules\\/.*/,
        /^\\/src\\/.*/,
      ],
      injectClientScript: false,
    }),
  ],
});
`;
}

// ─── Frontend generators ─────────────────────────────────────────────────────

function generateEntryClient(): string {
  return `import React from "react";
import { hydrateRoot } from "react-dom/client";
import Layout from "./layout";
import App from "./app";
import "./globals.css";

hydrateRoot(
  document.getElementById("root")!,
  <React.StrictMode>
    <Layout>
      <App />
    </Layout>
  </React.StrictMode>
);
`;
}

function generateEntryServer(): string {
  return `import React from "react";
import { renderToReadableStream } from "react-dom/server";
import Layout from "./layout";
import App from "./app";

export async function render(_url: string): Promise<ReadableStream> {
  const stream = await renderToReadableStream(
    <React.StrictMode>
      <Layout>
        <App />
      </Layout>
    </React.StrictMode>,
    {
      onError(error: unknown) {
        console.error("[voltx] SSR render error:", error);
      },
    }
  );
  return stream;
}
`;
}

function generateLayoutComponent(projectName: string): string {
  return `import React from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="font-semibold">${projectName}</span>
        </div>
        <a href="https://github.com/codewithshail/voltx" target="_blank" rel="noopener noreferrer" className="text-muted text-sm hover:text-foreground transition-colors">
          Built with VoltX
        </a>
      </header>
      <main>{children}</main>
    </div>
  );
}
`;
}

function generateGlobalCSS(useShadcn = false): string {
  if (useShadcn) {
    return `@import "tailwindcss";

@theme inline {
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --color-chart-1: hsl(var(--chart-1));
  --color-chart-2: hsl(var(--chart-2));
  --color-chart-3: hsl(var(--chart-3));
  --color-chart-4: hsl(var(--chart-4));
  --color-chart-5: hsl(var(--chart-5));
  --color-sidebar: hsl(var(--sidebar));
  --color-sidebar-foreground: hsl(var(--sidebar-foreground));
  --color-sidebar-primary: hsl(var(--sidebar-primary));
  --color-sidebar-primary-foreground: hsl(var(--sidebar-primary-foreground));
  --color-sidebar-accent: hsl(var(--sidebar-accent));
  --color-sidebar-accent-foreground: hsl(var(--sidebar-accent-foreground));
  --color-sidebar-border: hsl(var(--sidebar-border));
  --color-sidebar-ring: hsl(var(--sidebar-ring));
}

:root {
  --background: 0 0% 4%;
  --foreground: 0 0% 93%;
  --card: 0 0% 6%;
  --card-foreground: 0 0% 93%;
  --popover: 0 0% 6%;
  --popover-foreground: 0 0% 93%;
  --primary: 0 0% 93%;
  --primary-foreground: 0 0% 6%;
  --secondary: 0 0% 12%;
  --secondary-foreground: 0 0% 93%;
  --muted: 0 0% 12%;
  --muted-foreground: 0 0% 55%;
  --accent: 0 0% 12%;
  --accent-foreground: 0 0% 93%;
  --destructive: 0 62% 50%;
  --border: 0 0% 14%;
  --input: 0 0% 14%;
  --ring: 0 0% 83%;
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
  --sidebar: 0 0% 5%;
  --sidebar-foreground: 0 0% 93%;
  --sidebar-primary: 0 0% 93%;
  --sidebar-primary-foreground: 0 0% 6%;
  --sidebar-accent: 0 0% 12%;
  --sidebar-accent-foreground: 0 0% 93%;
  --sidebar-border: 0 0% 14%;
  --sidebar-ring: 0 0% 83%;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border-color: var(--color-border);
}

html,
body {
  height: 100%;
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

#root {
  height: 100%;
}
`;
  }

  return `@import "tailwindcss";

@theme {
  --color-background: #0a0a0a;
  --color-foreground: #ededed;
  --color-muted: #888888;
  --color-border: #222222;
  --color-primary: #2563eb;
  --color-accent: #a78bfa;
  --font-sans: system-ui, -apple-system, sans-serif;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

#root {
  height: 100%;
}

a {
  color: inherit;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
`;
}

function generateCnUtil(): string {
  return `import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
}

function generateComponentsJson(): string {
  return JSON.stringify({
    "$schema": "https://ui.shadcn.com/schema.json",
    style: "new-york",
    rsc: false,
    tsx: true,
    tailwind: {
      config: "",
      css: "src/globals.css",
      baseColor: "neutral",
      cssVariables: true,
    },
    aliases: {
      components: "@/components",
      utils: "@/lib/utils",
      ui: "@/components/ui",
      lib: "@/lib",
      hooks: "@/hooks",
    },
  }, null, 2) + "\n";
}

function generateAppComponent(projectName: string, template: string): string {
  if (template === "blank") {
    return `import React, { useState, useEffect } from "react";

export default function App() {
  const [status, setStatus] = useState<string>("checking...");

  useEffect(() => {
    fetch("/api")
      .then((res) => res.json())
      .then((data) => setStatus(data.status || "ok"))
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] px-6 py-12">
      <div className="text-center max-w-2xl w-full">
        {/* Hero */}
        <div className="relative mb-8">
          <div className="absolute inset-0 blur-3xl opacity-20 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full" />
          <div className="relative text-7xl mb-4">⚡</div>
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
          \${"\${projectName}"}
        </h1>
        <p className="text-muted text-lg mb-10">The AI-first full-stack framework</p>

        {/* Status cards */}
        <div className="flex gap-4 justify-center mb-10">
          <div className="px-6 py-4 rounded-xl bg-white/5 border border-border backdrop-blur-sm">
            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Server</div>
            <div className={\`text-sm font-medium \${status === "ok" ? "text-emerald-400" : "text-red-400"}\`}>
              <span className={\`inline-block w-2 h-2 rounded-full mr-2 \${status === "ok" ? "bg-emerald-400 animate-pulse" : "bg-red-400"}\`} />
              {status}
            </div>
          </div>
          <div className="px-6 py-4 rounded-xl bg-white/5 border border-border backdrop-blur-sm">
            <div className="text-xs text-muted mb-1 uppercase tracking-wider">Frontend</div>
            <div className="text-sm font-medium text-emerald-400">
              <span className="inline-block w-2 h-2 rounded-full mr-2 bg-emerald-400 animate-pulse" />
              React + Vite
            </div>
          </div>
          <div className="px-6 py-4 rounded-xl bg-white/5 border border-border backdrop-blur-sm">
            <div className="text-xs text-muted mb-1 uppercase tracking-wider">CSS</div>
            <div className="text-sm font-medium text-sky-400">Tailwind v4</div>
          </div>
        </div>

        {/* Get started */}
        <div className="bg-white/[0.03] border border-border rounded-2xl p-8 text-left backdrop-blur-sm">
          <h2 className="text-sm font-medium text-muted mb-6 uppercase tracking-wider">Get started</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-sm shrink-0">1</div>
              <div>
                <code className="text-purple-400 text-sm">src/app.tsx</code>
                <p className="text-muted text-sm mt-1">Edit this file to build your UI</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-sm shrink-0">2</div>
              <div>
                <code className="text-blue-400 text-sm">api/</code>
                <p className="text-muted text-sm mt-1">Add API routes here (file-based routing)</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm shrink-0">3</div>
              <div>
                <code className="text-emerald-400 text-sm">src/components/</code>
                <p className="text-muted text-sm mt-1">Create React components with Tailwind CSS</p>
              </div>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="flex gap-6 justify-center mt-8">
          <a href="https://github.com/codewithshail/voltx" target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-foreground transition-colors">
            GitHub →
          </a>
          <a href="https://voltx.co.in" target="_blank" rel="noopener noreferrer" className="text-sm text-muted hover:text-foreground transition-colors">
            Docs →
          </a>
        </div>
      </div>
    </div>
  );
}
`;
  }

  // Chat/RAG/Agent templates get a chat UI
  const apiEndpoint = template === "agent-app" ? "/api/agent" : template === "rag-app" ? "/api/rag/query" : "/api/chat";
  const isAgent = template === "agent-app";
  const isRag = template === "rag-app";

  let emptyStateTitle = "Start a conversation";
  let emptyStateHint = "Type a message below to chat with AI";
  let accentColor = "blue";
  let inputPlaceholder = "Type a message...";

  if (isAgent) {
    emptyStateTitle = "Talk to your AI agent";
    emptyStateHint = "The agent can use tools like Calculator and Date/Time";
    accentColor = "purple";
    inputPlaceholder = "Ask the agent anything...";
  } else if (isRag) {
    emptyStateTitle = "Ask your documents";
    emptyStateHint = "Query your knowledge base — ingest docs via POST /api/rag/ingest";
    accentColor = "emerald";
    inputPlaceholder = "Ask a question about your documents...";
  }

  return `import React, { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {${isAgent ? `
      const res = await fetch("${apiEndpoint}", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      const data = await res.json();
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsg.id ? { ...m, content: data.content || "No response" } : m)
      );` : `
      const res = await fetch("${apiEndpoint}", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({${isRag ? ` question: text ` : ` messages: [...messages, { role: "user", content: text }] `}}),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.textDelta ?? parsed.content ?? parsed.choices?.[0]?.delta?.content ?? "";
            if (chunk) {
              fullContent += chunk;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantMsg.id ? { ...m, content: fullContent } : m)
              );
            }
          } catch {}
        }
      }`}
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsg.id ? { ...m, content: "Error: " + (err instanceof Error ? err.message : String(err)) } : m)
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  return (
    <div className="h-[calc(100vh-60px)] flex flex-col">
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 blur-2xl opacity-20 bg-${accentColor}-500 rounded-full" />
                <div className="relative text-5xl">⚡</div>
              </div>
              <h2 className="text-2xl font-semibold mb-2">${emptyStateTitle}</h2>
              <p className="text-muted text-sm max-w-md">${emptyStateHint}</p>
              <div className="flex gap-2 mt-6">
                ${isAgent ? `<button onClick={() => { setInput("What is 42 * 17?"); }} className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-border text-muted hover:text-foreground hover:border-${accentColor}-500/50 transition-all cursor-pointer">
                  What is 42 × 17?
                </button>
                <button onClick={() => { setInput("What day is it today?"); }} className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-border text-muted hover:text-foreground hover:border-${accentColor}-500/50 transition-all cursor-pointer">
                  What day is it?
                </button>` : isRag ? `<button onClick={() => { setInput("Summarize the main topics"); }} className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-border text-muted hover:text-foreground hover:border-${accentColor}-500/50 transition-all cursor-pointer">
                  Summarize main topics
                </button>
                <button onClick={() => { setInput("What are the key findings?"); }} className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-border text-muted hover:text-foreground hover:border-${accentColor}-500/50 transition-all cursor-pointer">
                  Key findings
                </button>` : `<button onClick={() => { setInput("Hello! What can you do?"); }} className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-border text-muted hover:text-foreground hover:border-${accentColor}-500/50 transition-all cursor-pointer">
                  Hello! What can you do?
                </button>
                <button onClick={() => { setInput("Tell me a fun fact"); }} className="px-3 py-1.5 text-xs rounded-full bg-white/5 border border-border text-muted hover:text-foreground hover:border-${accentColor}-500/50 transition-all cursor-pointer">
                  Tell me a fun fact
                </button>`}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={\`mb-6 flex \${msg.role === "user" ? "justify-end" : "justify-start"}\`}>
              <div className={\`flex items-start gap-3 max-w-[80%] \${msg.role === "user" ? "flex-row-reverse" : ""}\`}>
                <div className={\`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 \${
                  msg.role === "user" ? "bg-${accentColor}-500 text-white" : "bg-white/10 text-muted"
                }\`}>
                  {msg.role === "user" ? "Y" : "⚡"}
                </div>
                <div className={\`px-4 py-3 rounded-2xl whitespace-pre-wrap leading-relaxed text-sm \${
                  msg.role === "user"
                    ? "bg-${accentColor}-500 text-white rounded-br-md"
                    : "bg-white/[0.05] border border-border rounded-bl-md"
                }\`}>
                  {msg.content || (isLoading && msg.role === "assistant" ? (
                    <span className="flex gap-1">
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-muted rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : "")}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>
      <footer className="border-t border-border px-4 py-4">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="max-w-3xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="${inputPlaceholder}"
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-xl bg-white/[0.05] border border-border text-foreground placeholder:text-muted/50 outline-none focus:border-${accentColor}-500/50 focus:ring-1 focus:ring-${accentColor}-500/25 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-${accentColor}-500 hover:bg-${accentColor}-400 text-white cursor-pointer"
          >
            {isLoading ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : "Send"}
          </button>
        </form>
      </footer>
    </div>
  );
}
`;
}

// ─── Public asset generators ─────────────────────────────────────────────────

function generateFaviconSVG(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0a0a0a"/>
  <path d="M18.5 4L8 18h7l-1.5 10L24 14h-7l1.5-10z" fill="#facc15" stroke="#facc15" stroke-width="0.5" stroke-linejoin="round"/>
</svg>
`;
}

function generateRobotsTxt(): string {
  return `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /

Sitemap: /sitemap.xml
`;
}

function generateWebManifest(projectName: string): string {
  return JSON.stringify({
    name: projectName,
    short_name: projectName,
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    theme_color: "#0a0a0a",
    background_color: "#0a0a0a",
    display: "standalone",
  }, null, 2) + "\n";
}
