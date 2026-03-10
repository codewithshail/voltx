#!/usr/bin/env node

import * as p from "@clack/prompts";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

// ─── ANSI helpers (zero-dep gradient banner) ─────────────────────────────────

const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const ITALIC = `${ESC}3m`;

function rgb(r: number, g: number, b: number, text: string): string {
  return `${ESC}38;2;${r};${g};${b}m${text}${RESET}`;
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

interface RGB { r: number; g: number; b: number }

function gradientLine(text: string, from: RGB, to: RGB): string {
  if (!text.length) return "";
  return text.split("").map((ch, i) => {
    const t = text.length === 1 ? 0 : i / (text.length - 1);
    return rgb(lerp(from.r, to.r, t), lerp(from.g, to.g, t), lerp(from.b, to.b, t), ch);
  }).join("");
}

function gradientBlock(lines: string[], colors: RGB[]): string {
  return lines.map((line, i) => {
    const t = lines.length === 1 ? 0 : i / (lines.length - 1);
    const seg = t * (colors.length - 1);
    const fi = Math.floor(seg);
    const ti = Math.min(fi + 1, colors.length - 1);
    const lt = seg - fi;
    const from = { r: lerp(colors[fi].r, colors[ti].r, lt), g: lerp(colors[fi].g, colors[ti].g, lt), b: lerp(colors[fi].b, colors[ti].b, lt) };
    const ni = Math.min(ti + 1, colors.length - 1);
    const to = { r: lerp(colors[ti].r, colors[ni].r, lt), g: lerp(colors[ti].g, colors[ni].g, lt), b: lerp(colors[ti].b, colors[ni].b, lt) };
    return gradientLine(line, from, to);
  }).join("\n");
}

const BANNER = [
  "  ██╗   ██╗ ██████╗ ██╗  ████████╗██╗  ██╗",
  "  ██║   ██║██╔═══██╗██║  ╚══██╔══╝╚██╗██╔╝",
  "  ██║   ██║██║   ██║██║     ██║    ╚███╔╝ ",
  "  ╚██╗ ██╔╝██║   ██║██║     ██║    ██╔██╗ ",
  "   ╚████╔╝ ╚██████╔╝███████╗██║   ██╔╝ ██╗",
  "    ╚═══╝   ╚═════╝ ╚══════╝╚═╝   ╚═╝  ╚═╝",
];

const COLORS: RGB[] = [
  { r: 0, g: 180, b: 255 },
  { r: 120, g: 80, b: 255 },
  { r: 255, g: 50, b: 180 },
  { r: 255, g: 120, b: 50 },
];

// ─── CLI argument parsing ────────────────────────────────────────────────────

type AuthChoice = "better-auth" | "jwt" | "none";

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let projectName: string | undefined;
  let template: string | undefined;
  let useDefault = false;
  let pkgManager: string | undefined;
  let auth: AuthChoice | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--yes" || arg === "-y" || arg === "--default") {
      useDefault = true;
    } else if (arg === "--template" && args[i + 1]) {
      template = args[++i];
    } else if (arg === "--auth" && args[i + 1]) {
      auth = args[++i] as AuthChoice;
    } else if ((arg === "--use-npm" || arg === "--use-pnpm" || arg === "--use-yarn" || arg === "--use-bun")) {
      pkgManager = arg.replace("--use-", "");
    } else if (!arg.startsWith("-") && !projectName) {
      projectName = arg;
    }
  }

  return { projectName, template, useDefault, pkgManager, auth };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VOLTX_VERSIONS: Record<string, string> = {
  "@voltx/core": "^0.3.1",
  "@voltx/server": "^0.3.1",
  "@voltx/cli": "^0.3.5",
  "@voltx/ai": "^0.3.0",
  "@voltx/agents": "^0.3.1",
  "@voltx/memory": "^0.3.0",
  "@voltx/db": "^0.3.0",
  "@voltx/rag": "^0.3.1",
  "@voltx/auth": "^0.3.0",
  "@voltx/ui": "^0.3.0",
};

function vv(pkg: string): string { return VOLTX_VERSIONS[pkg] ?? "^0.3.0"; }

const TEMPLATES: Record<string, { label: string; hint: string; deps: Record<string, string> }> = {
  blank: {
    label: "Blank",
    hint: "Full-stack starter with React + Hono + file-based routing",
    deps: { "@voltx/core": vv("@voltx/core"), "@voltx/server": vv("@voltx/server") },
  },
  chatbot: {
    label: "Chatbot",
    hint: "Streaming chat with AI + memory + file-based routes",
    deps: { "@voltx/core": vv("@voltx/core"), "@voltx/ai": vv("@voltx/ai"), "@voltx/server": vv("@voltx/server"), "@voltx/memory": vv("@voltx/memory") },
  },
  "rag-app": {
    label: "RAG App",
    hint: "Document Q&A with vector DB + streaming + file-based routes",
    deps: { "@voltx/core": vv("@voltx/core"), "@voltx/ai": vv("@voltx/ai"), "@voltx/server": vv("@voltx/server"), "@voltx/rag": vv("@voltx/rag"), "@voltx/db": vv("@voltx/db") },
  },
  "agent-app": {
    label: "Agent App",
    hint: "AI agent with tools, memory, DB + file-based routes",
    deps: { "@voltx/core": vv("@voltx/core"), "@voltx/ai": vv("@voltx/ai"), "@voltx/server": vv("@voltx/server"), "@voltx/agents": vv("@voltx/agents"), "@voltx/memory": vv("@voltx/memory") },
  },
};

const PROVIDER_ENV_KEYS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  ollama: "",
};

const PROVIDER_MODELS: Record<string, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.0-flash",
  cerebras: "llama3.1-8b",
  openrouter: "meta-llama/llama-3.3-70b-instruct",
  ollama: "llama3",
};

const EMBEDDING_CAPABLE = new Set(["openai", "google", "ollama"]);

const EMBEDDING_MODELS: Record<string, string> = {
  openai: "openai:text-embedding-3-small",
  google: "google:text-embedding-004",
  ollama: "ollama:nomic-embed-text",
};

const ALL_PROVIDERS = [
  { value: "cerebras", label: "Cerebras", hint: "Free tier, fast inference (Llama models)" },
  { value: "openai", label: "OpenAI", hint: "GPT-4o, GPT-4o-mini — embeddings supported" },
  { value: "anthropic", label: "Anthropic", hint: "Claude Sonnet, Claude Opus — no embeddings" },
  { value: "google", label: "Google AI", hint: "Gemini Pro, Gemini Flash — embeddings supported" },
  { value: "openrouter", label: "OpenRouter", hint: "Access 100+ models via one API — no embeddings" },
  { value: "ollama", label: "Ollama", hint: "Local models, no API key — embeddings supported" },
];

// ─── Agent tool definitions ──────────────────────────────────────────────────

interface AgentToolDef {
  label: string;
  hint: string;
  envKey: string;
  envHint: string;
}

const AGENT_TOOLS: Record<string, AgentToolDef> = {
  calculator: { label: "Calculator", hint: "Math expressions — no API key needed", envKey: "", envHint: "" },
  datetime: { label: "Date & Time", hint: "Current date/time/timezone — no API key needed", envKey: "", envHint: "" },
  "web-search-tavily": { label: "Web Search (Tavily)", hint: "AI-optimized search — 1,000 free credits/month", envKey: "TAVILY_API_KEY", envHint: "tvly-..." },
  "web-search-serper": { label: "Web Search (Serper)", hint: "Google search — 2,500 free searches/month", envKey: "SERPER_API_KEY", envHint: "" },
  weather: { label: "Weather (OpenWeatherMap)", hint: "Current weather — 1,000 free calls/day", envKey: "OPENWEATHER_API_KEY", envHint: "" },
  news: { label: "News (NewsAPI)", hint: "Top headlines & search — free for dev", envKey: "NEWS_API_KEY", envHint: "" },
};

// ─── Package manager helpers ─────────────────────────────────────────────────

type PkgManager = "npm" | "pnpm" | "yarn" | "bun";

function detectPackageManager(): PkgManager {
  const ua = process.env.npm_config_user_agent ?? "";
  if (ua.startsWith("pnpm")) return "pnpm";
  if (ua.startsWith("yarn")) return "yarn";
  if (ua.startsWith("bun")) return "bun";
  return "npm";
}

function installCommand(pm: PkgManager): string {
  return pm === "yarn" ? "yarn" : `${pm} install`;
}

function runCommand(pm: PkgManager): string {
  return pm === "npm" ? "npm run" : pm;
}

// ─── Scaffold options ────────────────────────────────────────────────────────

interface ScaffoldOptions {
  projectDir: string;
  projectName: string;
  template: string;
  pm: PkgManager;
  authChoice: AuthChoice;
  aiProvider: string;
  enableRag: boolean;
  embeddingProvider: string;       // only used when enableRag + provider has no embeddings
  selectedTools: string[];         // agent-app only
  apiKeys: Record<string, string>; // all collected API keys (provider, tools, embedding)
  useShadcn: boolean;              // include shadcn/ui base setup
}

// ─── Scaffold logic ──────────────────────────────────────────────────────────

function scaffold(opts: ScaffoldOptions): void {
  const { projectDir, projectName, template, pm, authChoice, aiProvider, enableRag, embeddingProvider, selectedTools, apiKeys, useShadcn } = opts;
  const tmpl = TEMPLATES[template] ?? TEMPLATES["blank"];

  fs.mkdirSync(projectDir, { recursive: true });

  // Build dependencies
  const deps: Record<string, string> = { ...tmpl.deps };
  if (authChoice === "better-auth") { deps["@voltx/auth"] = vv("@voltx/auth"); deps["better-auth"] = "^1.5.0"; }
  else if (authChoice === "jwt") { deps["@voltx/auth"] = vv("@voltx/auth"); deps["jose"] = "^6.0.0"; }
  // Add RAG deps for chatbot/agent-app when RAG is enabled
  if (enableRag && (template === "chatbot" || template === "agent-app")) {
    deps["@voltx/rag"] = vv("@voltx/rag");
    deps["@voltx/db"] = vv("@voltx/db");
  }

  // package.json
  const isFullStack = true; // All templates are full-stack (Vite + React)
  const devDeps: Record<string, string> = { typescript: "^5.7.0", tsx: "^4.21.0", tsup: "^8.0.0", "@types/node": "^22.0.0" };

  // Full-stack templates get Vite + React + Hono
  if (isFullStack) {
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
  }

  // shadcn/ui base deps
  if (useShadcn) {
    deps["class-variance-authority"] = "^0.7.0";
    deps["clsx"] = "^2.1.0";
    deps["tailwind-merge"] = "^3.0.0";
    deps["lucide-react"] = "^0.468.0";
  }

  const pkg = {
    name: projectName,
    version: "0.1.0",
    private: true,
    scripts: { dev: "voltx dev", build: "voltx build", start: "voltx start" },
    dependencies: { ...deps, "@voltx/cli": vv("@voltx/cli") },
    devDependencies: devDeps,
  };
  fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify(pkg, null, 2));

  // voltx.config.ts
  fs.writeFileSync(path.join(projectDir, "voltx.config.ts"), generateConfig(projectName, template, authChoice, aiProvider, enableRag));

  // tsconfig.json
  const tsconfig: Record<string, unknown> = {
    compilerOptions: {
      target: "ES2022", module: "ESNext", moduleResolution: "bundler",
      strict: true, esModuleInterop: true, skipLibCheck: true, outDir: "dist",
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
      ...(isFullStack ? { jsx: "react-jsx" } : {}),
    },
    include: ["src", "api", "server.ts", "voltx.config.ts"],
  };
  if (template === "agent-app") (tsconfig.include as string[]).push("agents", "tools");
  fs.writeFileSync(path.join(projectDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

  // Directories
  fs.mkdirSync(path.join(projectDir, "api"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, "public"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, "src"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, "src", "components"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, "src", "hooks"), { recursive: true });
  fs.mkdirSync(path.join(projectDir, "src", "lib"), { recursive: true });

  // Public assets
  fs.writeFileSync(path.join(projectDir, "public", "favicon.svg"), generateFaviconSVG());
  fs.writeFileSync(path.join(projectDir, "public", "robots.txt"), generateRobotsTxt());
  fs.writeFileSync(path.join(projectDir, "public", "site.webmanifest"), generateWebManifest(projectName));

  // server.ts — Hono app entry (exports default for Vite dev server)
  fs.writeFileSync(
    path.join(projectDir, "server.ts"),
    generateServerEntry(projectName, template, enableRag)
  );

  // src/app.tsx — Root React component
  fs.writeFileSync(path.join(projectDir, "src", "app.tsx"), generateAppComponent(projectName, template, enableRag));

  // src/layout.tsx — Root layout
  fs.writeFileSync(path.join(projectDir, "src", "layout.tsx"), generateLayoutComponent(projectName));

  // src/globals.css — Global styles
  fs.writeFileSync(path.join(projectDir, "src", "globals.css"), generateGlobalCSS(useShadcn));

  // shadcn/ui setup
  if (useShadcn) {
    fs.writeFileSync(path.join(projectDir, "src", "lib", "utils.ts"), generateCnUtil());
    fs.writeFileSync(path.join(projectDir, "components.json"), generateComponentsJson());
  }

  // src/entry-client.tsx — Client hydration entry
  fs.writeFileSync(path.join(projectDir, "src", "entry-client.tsx"), generateEntryClient());

  // src/entry-server.tsx — SSR rendering entry
  fs.writeFileSync(path.join(projectDir, "src", "entry-server.tsx"), generateEntryServer());

  // vite.config.ts
  fs.writeFileSync(path.join(projectDir, "vite.config.ts"), generateViteConfigFile("server.ts"));

  // api/index.ts — health check
  fs.writeFileSync(
    path.join(projectDir, "api", "index.ts"),
    `// GET /api — Health check\nimport type { Context } from "@voltx/server";\n\nexport function GET(c: Context) {\n  return c.json({ name: "${projectName}", status: "ok" });\n}\n`
  );

  const modelStr = `${aiProvider}:${PROVIDER_MODELS[aiProvider] ?? "llama3.1-8b"}`;

  // Resolve embedding model
  const effectiveEmbedProvider = EMBEDDING_CAPABLE.has(aiProvider) ? aiProvider : embeddingProvider;
  const embedModel = EMBEDDING_MODELS[effectiveEmbedProvider] ?? "openai:text-embedding-3-small";

  // ── Chat route (chatbot + agent-app) ───────────────────────────────────────
  if (template === "chatbot" || template === "agent-app") {
    if (template === "chatbot" && enableRag) {
      fs.writeFileSync(
        path.join(projectDir, "api", "chat.ts"),
        generateChatRouteWithRag(modelStr, embedModel)
      );
    } else {
      fs.writeFileSync(
        path.join(projectDir, "api", "chat.ts"),
        generateChatRoute(modelStr)
      );
    }
  }

  // ── RAG ingest route (rag-app, or chatbot/agent-app with RAG enabled) ──────
  if (template === "rag-app" || enableRag) {
    fs.mkdirSync(path.join(projectDir, "api", "rag"), { recursive: true });

    if (template === "rag-app") {
      fs.writeFileSync(path.join(projectDir, "api", "rag", "query.ts"), generateRagQueryRoute(modelStr, embedModel));
    }

    fs.writeFileSync(path.join(projectDir, "api", "rag", "ingest.ts"), generateRagIngestRoute(embedModel));
  }

  // ── Agent-specific files ───────────────────────────────────────────────────
  if (template === "agent-app") {
    fs.mkdirSync(path.join(projectDir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "tools"), { recursive: true });

    const toolImports: string[] = [];
    const toolNames: string[] = [];

    for (const toolId of selectedTools) {
      writeToolFile(projectDir, toolId, toolImports, toolNames);
    }

    // If RAG enabled for agent-app, add a rag_search tool
    if (enableRag) {
      toolImports.push('import { ragSearchTool } from "../tools/rag-search";');
      toolNames.push("ragSearchTool");
      fs.writeFileSync(
        path.join(projectDir, "tools", "rag-search.ts"),
        generateRagSearchTool(embedModel)
      );
    }

    const toolDescriptions = selectedTools.map((t) => AGENT_TOOLS[t]?.label || t).join(", ") + (enableRag ? ", RAG Search" : "");

    // Agent definition
    fs.writeFileSync(
      path.join(projectDir, "agents", "assistant.ts"),
      `// AI Agent — autonomous assistant with tools\nimport { createAgent } from "@voltx/agents";\n${toolImports.join("\n")}\n\nexport const assistant = createAgent({\n  name: "assistant",\n  model: "${modelStr}",\n  instructions: "You are a helpful AI assistant with access to tools: ${toolDescriptions}. Use them when needed to answer questions accurately.",\n  tools: [${toolNames.join(", ")}],\n  maxIterations: 5,\n});\n`
    );

    // Agent API route
    fs.writeFileSync(
      path.join(projectDir, "api", "agent.ts"),
      `// POST /api/agent — Run the AI agent\nimport type { Context } from "@voltx/server";\nimport { assistant } from "../agents/assistant";\n\nexport async function POST(c: Context) {\n  const { input } = await c.req.json();\n\n  if (!input || typeof input !== "string") {\n    return c.json({ error: "Missing 'input' field" }, 400);\n  }\n\n  const result = await assistant.run(input);\n  return c.json({\n    content: result.content,\n    steps: result.steps,\n    finishReason: result.finishReason,\n  });\n}\n`
    );
  }

  // ── Auth routes ────────────────────────────────────────────────────────────
  writeAuthFiles(projectDir, authChoice);

  // ── .env.example ───────────────────────────────────────────────────────────
  fs.writeFileSync(path.join(projectDir, ".env.example"), generateEnvExample(opts));

  // ── .env (real, gitignored) ────────────────────────────────────────────────
  fs.writeFileSync(path.join(projectDir, ".env"), generateEnvFile(opts));

  // ── .gitignore + README ────────────────────────────────────────────────────
  fs.writeFileSync(path.join(projectDir, ".gitignore"), "node_modules\ndist\n.env\n.env.local\n.env.*.local\nvite.config.voltx.ts\n");
  fs.writeFileSync(path.join(projectDir, "README.md"), generateReadme(projectName, template, pm));
}

// ─── Route generators ────────────────────────────────────────────────────────

function generateChatRoute(modelStr: string): string {
  return `// POST /api/chat — Streaming chat with conversation memory
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
    model: "${modelStr}",
    system: "You are a helpful AI assistant.",
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  result.text.then(async (text) => {
    await memory.add(conversationId, { role: "assistant", content: text });
  });

  return result.toSSEResponse();
}
`;
}

function generateChatRouteWithRag(modelStr: string, embedModel: string): string {
  return `// POST /api/chat — Streaming chat with RAG context + conversation memory
import type { Context } from "@voltx/server";
import { streamText } from "@voltx/ai";
import { createMemory } from "@voltx/memory";
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const memory = createMemory({ maxMessages: 50 });
const vectorStore = createVectorStore();
const embedder = createEmbedder({ model: "${embedModel}" });
const rag = createRAGPipeline({ embedder, vectorStore });

export async function POST(c: Context) {
  const { messages, conversationId = "default" } = await c.req.json();

  const lastMessage = messages[messages.length - 1];
  if (lastMessage?.role === "user") {
    await memory.add(conversationId, { role: "user", content: lastMessage.content });
  }

  const history = await memory.get(conversationId);

  // Pull relevant context from the vector store
  const ragContext = await rag.getContext(lastMessage?.content ?? "", { topK: 5 });

  const systemPrompt = ragContext
    ? \`You are a helpful AI assistant. Use the following context to answer questions when relevant.\\n\\nContext:\\n\${ragContext}\`
    : "You are a helpful AI assistant.";

  const result = await streamText({
    model: "${modelStr}",
    system: systemPrompt,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
  });

  result.text.then(async (text) => {
    await memory.add(conversationId, { role: "assistant", content: text });
  });

  return result.toSSEResponse();
}
`;
}

function generateRagQueryRoute(modelStr: string, embedModel: string): string {
  return `// POST /api/rag/query — Query documents with RAG
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
    model: "${modelStr}",
    system: \`Answer the user's question based on the following context. If the context doesn't contain relevant information, say so.\\n\\nContext:\\n\${context}\`,
    messages: [{ role: "user", content: question }],
  });

  return result.toSSEResponse();
}
`;
}

function generateRagIngestRoute(embedModel: string): string {
  return `// POST /api/rag/ingest — Ingest documents into the vector store
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
`;
}

function generateRagSearchTool(embedModel: string): string {
  return `// RAG Search tool — queries your knowledge base via vector similarity
import type { Tool } from "@voltx/agents";
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const vectorStore = createVectorStore();
const embedder = createEmbedder({ model: "${embedModel}" });
const rag = createRAGPipeline({ embedder, vectorStore });

export const ragSearchTool: Tool = {
  name: "rag_search",
  description: "Search your knowledge base for relevant information. Use this when the user asks about documents, files, or data that has been ingested. Ingest documents via POST /api/rag/ingest first.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query to find relevant documents" },
    },
    required: ["query"],
  },
  async execute(args: { query: string }) {
    try {
      const context = await rag.getContext(args.query, { topK: 5 });
      return context || "No relevant documents found. Try ingesting documents first via POST /api/rag/ingest.";
    } catch (err) {
      return \`RAG search failed: \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`;
}

// ─── Tool file writer ────────────────────────────────────────────────────────

function writeToolFile(projectDir: string, toolId: string, toolImports: string[], toolNames: string[]): void {
  const toolsDir = path.join(projectDir, "tools");

  if (toolId === "calculator") {
    toolImports.push('import { calculatorTool } from "../tools/calculator";');
    toolNames.push("calculatorTool");
    fs.writeFileSync(path.join(toolsDir, "calculator.ts"), `// Calculator tool — evaluates math expressions (no API key needed)
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
`);
  }

  if (toolId === "datetime") {
    toolImports.push('import { datetimeTool } from "../tools/datetime";');
    toolNames.push("datetimeTool");
    fs.writeFileSync(path.join(toolsDir, "datetime.ts"), `// Date & time tool — returns current date, time, timezone (no API key needed)
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
      timeZone: tz, weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
    return \`Current date/time (\${tz}): \${formatted}\`;
  },
};
`);
  }

  if (toolId === "web-search-tavily") {
    toolImports.push('import { tavilySearchTool } from "../tools/web-search-tavily";');
    toolNames.push("tavilySearchTool");
    fs.writeFileSync(path.join(toolsDir, "web-search-tavily.ts"), `// Web Search tool — powered by Tavily (https://tavily.com)
// Free tier: 1,000 API credits/month — sign up at https://app.tavily.com
import type { Tool } from "@voltx/agents";

export const tavilySearchTool: Tool = {
  name: "web_search_tavily",
  description: "Search the web for current information using Tavily. Returns relevant results with titles, URLs, and content snippets.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "The search query" } },
    required: ["query"],
  },
  async execute(args: { query: string }) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return "Error: TAVILY_API_KEY not set in .env";
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": \`Bearer \${apiKey}\` },
        body: JSON.stringify({ query: args.query, search_depth: "basic", max_results: 5 }),
      });
      if (!res.ok) return \`Search error: \${res.status} \${res.statusText}\`;
      const data = await res.json() as { results: Array<{ title: string; url: string; content: string }> };
      return data.results.map((r, i) => \`[\${i + 1}] \${r.title}\\n    \${r.url}\\n    \${r.content.slice(0, 200)}\`).join("\\n\\n") || "No results found.";
    } catch (err) {
      return \`Search failed: \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`);
  }

  if (toolId === "web-search-serper") {
    toolImports.push('import { serperSearchTool } from "../tools/web-search-serper";');
    toolNames.push("serperSearchTool");
    fs.writeFileSync(path.join(toolsDir, "web-search-serper.ts"), `// Web Search tool — powered by Serper (https://serper.dev)
// Free tier: 2,500 searches/month — sign up at https://serper.dev
import type { Tool } from "@voltx/agents";

export const serperSearchTool: Tool = {
  name: "web_search_serper",
  description: "Search Google for current information using Serper. Returns relevant results with titles, URLs, and snippets.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "The search query" } },
    required: ["query"],
  },
  async execute(args: { query: string }) {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return "Error: SERPER_API_KEY not set in .env";
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
        body: JSON.stringify({ q: args.query, num: 5 }),
      });
      if (!res.ok) return \`Search error: \${res.status} \${res.statusText}\`;
      const data = await res.json() as { organic: Array<{ title: string; link: string; snippet: string }> };
      return (data.organic || []).map((r, i) => \`[\${i + 1}] \${r.title}\\n    \${r.link}\\n    \${r.snippet}\`).join("\\n\\n") || "No results found.";
    } catch (err) {
      return \`Search failed: \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`);
  }

  if (toolId === "weather") {
    toolImports.push('import { weatherTool } from "../tools/weather";');
    toolNames.push("weatherTool");
    fs.writeFileSync(path.join(toolsDir, "weather.ts"), `// Weather tool — powered by OpenWeatherMap (https://openweathermap.org)
// Free tier: 1,000 calls/day — sign up at https://openweathermap.org/api
import type { Tool } from "@voltx/agents";

export const weatherTool: Tool = {
  name: "weather",
  description: "Get the current weather for a city. Returns temperature, conditions, humidity, and wind speed.",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name, e.g. 'London' or 'Mumbai, IN'" },
      units: { type: "string", description: "Temperature units: 'metric' (°C) or 'imperial' (°F). Default: metric" },
    },
    required: ["city"],
  },
  async execute(args: { city: string; units?: string }) {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) return "Error: OPENWEATHER_API_KEY not set in .env";
    const units = args.units || "metric";
    const unitSymbol = units === "imperial" ? "°F" : "°C";
    try {
      const url = \`https://api.openweathermap.org/data/2.5/weather?q=\${encodeURIComponent(args.city)}&units=\${units}&appid=\${apiKey}\`;
      const res = await fetch(url);
      if (!res.ok) return \`Weather error: \${res.status} — city "\${args.city}" not found or API error\`;
      const data = await res.json() as { name: string; main: { temp: number; feels_like: number; humidity: number }; weather: Array<{ description: string }>; wind: { speed: number } };
      return \`Weather in \${data.name}: \${data.main.temp}\${unitSymbol} (feels like \${data.main.feels_like}\${unitSymbol}), \${data.weather[0]?.description || "N/A"}, humidity \${data.main.humidity}%, wind \${data.wind.speed} \${units === "imperial" ? "mph" : "m/s"}\`;
    } catch (err) {
      return \`Weather fetch failed: \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`);
  }

  if (toolId === "news") {
    toolImports.push('import { newsTool } from "../tools/news";');
    toolNames.push("newsTool");
    fs.writeFileSync(path.join(toolsDir, "news.ts"), `// News tool — powered by NewsAPI (https://newsapi.org)
// Free tier: 100 requests/day for dev — sign up at https://newsapi.org/register
import type { Tool } from "@voltx/agents";

export const newsTool: Tool = {
  name: "news",
  description: "Get the latest news headlines. Can search by topic or get top headlines by country.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query for news, e.g. 'AI' or 'climate change'" },
      country: { type: "string", description: "2-letter country code for top headlines, e.g. 'us', 'in', 'gb'. Default: us" },
    },
  },
  async execute(args: { query?: string; country?: string }) {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) return "Error: NEWS_API_KEY not set in .env";
    try {
      let url: string;
      if (args.query) {
        url = \`https://newsapi.org/v2/everything?q=\${encodeURIComponent(args.query)}&pageSize=5&sortBy=publishedAt&apiKey=\${apiKey}\`;
      } else {
        url = \`https://newsapi.org/v2/top-headlines?country=\${args.country || "us"}&pageSize=5&apiKey=\${apiKey}\`;
      }
      const res = await fetch(url);
      if (!res.ok) return \`News error: \${res.status} \${res.statusText}\`;
      const data = await res.json() as { articles: Array<{ title: string; source: { name: string }; url: string; description: string }> };
      return (data.articles || []).map((a, i) => \`[\${i + 1}] \${a.title}\\n    Source: \${a.source?.name || "Unknown"} — \${a.url}\\n    \${(a.description || "").slice(0, 150)}\`).join("\\n\\n") || "No news found.";
    } catch (err) {
      return \`News fetch failed: \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`);
  }
}

// ─── Auth file writer ────────────────────────────────────────────────────────

function writeAuthFiles(projectDir: string, authChoice: AuthChoice): void {
  if (authChoice === "better-auth") {
    fs.mkdirSync(path.join(projectDir, "api", "auth"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "api", "auth", "[...path].ts"),
      `// ALL /api/auth/* — Better Auth handler (sign-up, sign-in, OAuth, sessions)\nimport type { Context } from "@voltx/server";\nimport { auth } from "../../src/lib/auth";\nimport { createAuthHandler } from "@voltx/auth";\n\nconst handler = createAuthHandler(auth);\n\nexport const GET = (c: Context) => handler(c);\nexport const POST = (c: Context) => handler(c);\n`
    );
    fs.writeFileSync(
      path.join(projectDir, "src", "lib", "auth.ts"),
      `// Auth configuration — Better Auth with DB-backed sessions\nimport { createAuth, createAuthMiddleware } from "@voltx/auth";\n\nexport const auth = createAuth("better-auth", {\n  database: process.env.DATABASE_URL!,\n  emailAndPassword: true,\n});\n\nexport const authMiddleware = createAuthMiddleware({\n  provider: auth,\n  publicPaths: ["/api/auth", "/api/health", "/"],\n});\n`
    );
  } else if (authChoice === "jwt") {
    fs.writeFileSync(
      path.join(projectDir, "src", "lib", "auth.ts"),
      `// Auth configuration — JWT (stateless)\nimport { createAuth, createAuthMiddleware } from "@voltx/auth";\n\nexport const jwt = createAuth("jwt", {\n  secret: process.env.JWT_SECRET!,\n  expiresIn: "7d",\n});\n\nexport const authMiddleware = createAuthMiddleware({\n  provider: jwt,\n  publicPaths: ["/api/auth", "/api/health", "/"],\n});\n`
    );
    fs.writeFileSync(
      path.join(projectDir, "api", "auth.ts"),
      `// POST /api/auth/login — Example JWT login route\nimport type { Context } from "@voltx/server";\nimport { jwt } from "../src/lib/auth";\n\nexport async function POST(c: Context) {\n  const { email, password } = await c.req.json();\n  if (!email || !password) {\n    return c.json({ error: "Email and password are required" }, 400);\n  }\n  const token = await jwt.sign({ sub: email, email });\n  return c.json({ token });\n}\n`
    );
  }
}

// ─── Config generator ────────────────────────────────────────────────────────

function generateConfig(projectName: string, template: string, authChoice: AuthChoice, aiProvider: string, enableRag: boolean): string {
  const hasDb = template === "rag-app" || template === "agent-app" || authChoice === "better-auth" || enableRag;
  const model = PROVIDER_MODELS[aiProvider] ?? "llama3.1-8b";

  let config = `import { defineConfig } from "@voltx/core";\n\nexport default defineConfig({\n  name: "${projectName}",\n  port: 3000,\n  ai: {\n    provider: "${aiProvider}",\n    model: "${model}",\n  },`;
  if (hasDb) config += `\n  db: {\n    url: process.env.DATABASE_URL,\n  },`;
  if (authChoice !== "none") config += `\n  auth: {\n    provider: "${authChoice}",\n  },`;
  config += `\n  server: {\n    routesDir: "api",\n    staticDir: "public",\n    cors: true,\n  },\n});\n`;
  return config;
}

// ─── Env generators ──────────────────────────────────────────────────────────

function collectRequiredKeys(opts: ScaffoldOptions): Array<{ envVar: string; label: string; hint: string }> {
  const keys: Array<{ envVar: string; label: string; hint: string }> = [];
  const { template, aiProvider, enableRag, embeddingProvider, selectedTools, authChoice } = opts;

  // Provider key
  const provKey = PROVIDER_ENV_KEYS[aiProvider];
  if (provKey) keys.push({ envVar: provKey, label: `${aiProvider} API key`, hint: "" });

  // Embedding provider key (if different from main provider)
  if (enableRag && !EMBEDDING_CAPABLE.has(aiProvider)) {
    const embedKey = PROVIDER_ENV_KEYS[embeddingProvider];
    if (embedKey && embedKey !== provKey) {
      keys.push({ envVar: embedKey, label: `${embeddingProvider} API key (for embeddings)`, hint: "" });
    }
  }

  // Tool keys (agent-app)
  if (template === "agent-app") {
    for (const toolId of selectedTools) {
      const def = AGENT_TOOLS[toolId];
      if (def?.envKey) keys.push({ envVar: def.envKey, label: `${def.label} API key`, hint: def.envHint });
    }
  }

  // Auth keys
  if (authChoice === "better-auth") {
    keys.push({ envVar: "BETTER_AUTH_SECRET", label: "Better Auth secret (min 32 chars)", hint: "" });
  } else if (authChoice === "jwt") {
    keys.push({ envVar: "JWT_SECRET", label: "JWT secret key", hint: "" });
  }

  return keys;
}

function generateEnvFile(opts: ScaffoldOptions): string {
  const keys = collectRequiredKeys(opts);
  let env = "";
  for (const k of keys) {
    const val = opts.apiKeys[k.envVar];
    if (val) {
      env += `${k.envVar}=${val}\n`;
    } else {
      env += `# ${k.envVar}=\n`;
    }
  }
  env += "PORT=3000\nNODE_ENV=development\n";
  return env;
}

function generateEnvExample(opts: ScaffoldOptions): string {
  const { template, aiProvider, enableRag, embeddingProvider, selectedTools, authChoice } = opts;
  let env = "";

  // Provider
  const provKey = PROVIDER_ENV_KEYS[aiProvider];
  if (provKey) {
    env += `# ─── LLM Provider ────────────────────────────────\n${provKey}=your-key-here\n\n`;
  } else {
    env += "# ─── LLM Provider (Ollama — no key needed) ───────\n# OLLAMA_BASE_URL=http://localhost:11434\n\n";
  }

  // Embedding provider (if separate)
  if (enableRag && !EMBEDDING_CAPABLE.has(aiProvider)) {
    const embedKey = PROVIDER_ENV_KEYS[embeddingProvider];
    if (embedKey && embedKey !== provKey) {
      env += `# ─── Embedding Provider (${embeddingProvider}) ──────────────────\n${embedKey}=your-key-here\n\n`;
    }
  }

  // Database
  if (template === "rag-app" || enableRag || template === "agent-app" || authChoice === "better-auth") {
    env += "# ─── Database (Neon Postgres — optional) ─────────\nDATABASE_URL=\n\n";
  }

  // Tool keys
  if (template === "agent-app" && selectedTools.length > 0) {
    const toolsWithKeys = selectedTools.map((t) => AGENT_TOOLS[t]).filter((d) => d?.envKey);
    if (toolsWithKeys.length > 0) {
      env += "# ─── Tool API Keys ───────────────────────────────\n";
      for (const def of toolsWithKeys) {
        env += `# ${def.envKey}=          (${def.label})\n`;
      }
      env += "\n";
    }
  }

  // Auth
  if (authChoice === "better-auth") {
    env += "# ─── Auth (Better Auth) ──────────────────────────\nBETTER_AUTH_SECRET=your-secret-key-min-32-chars-here\nBETTER_AUTH_URL=http://localhost:3000\n\n";
  } else if (authChoice === "jwt") {
    env += "# ─── Auth (JWT) ──────────────────────────────────\nJWT_SECRET=your-jwt-secret-key\n\n";
  }

  env += "# ─── App ─────────────────────────────────────────\nPORT=3000\nNODE_ENV=development\n";
  return env;
}

// ─── README generator ────────────────────────────────────────────────────────









// ─── README generator ────────────────────────────────────────────────────────

function generateReadme(projectName: string, template: string, pm: PkgManager): string {
  return `# ${projectName}

Built with [VoltX](https://voltx.dev) — the AI-first full-stack framework.

Template: **${template}**

## Getting Started

\`\`\`bash
${installCommand(pm)}
${runCommand(pm)} dev
\`\`\`

## Generate Code

\`\`\`bash
npx voltx generate route api/users
npx voltx generate agent assistant
npx voltx generate tool search
npx voltx generate job cleanup
\`\`\`

## Configuration

Edit \`voltx.config.ts\` to configure your AI provider, database, and auth settings.
Edit \`.env\` to add your API keys.

## Learn More

- [GitHub](https://github.com/codewithshail/voltx)
`;
}

// ─── Git init ────────────────────────────────────────────────────────────────

function tryGitInit(projectDir: string): boolean {
  try {
    execSync("git init", { cwd: projectDir, stdio: "ignore" });
    execSync("git add -A", { cwd: projectDir, stdio: "ignore" });
    execSync('git commit -m "Initial commit from create-voltx-app"', { cwd: projectDir, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ─── Vite + Frontend generators ──────────────────────────────────────────────

function generateServerEntry(projectName: string, template: string, enableRag: boolean): string {
  // Build route imports based on template
  const imports: string[] = [];
  const mounts: string[] = [];

  // Health check route (all templates)
  imports.push('import { GET as healthGET } from "./api/index";');
  mounts.push('app.get("/api", healthGET);');

  // Chat route (chatbot + agent-app)
  if (template === "chatbot" || template === "agent-app") {
    imports.push('import { POST as chatPOST } from "./api/chat";');
    mounts.push('app.post("/api/chat", chatPOST);');
  }

  // Agent route
  if (template === "agent-app") {
    imports.push('import { POST as agentPOST } from "./api/agent";');
    mounts.push('app.post("/api/agent", agentPOST);');
  }

  // RAG routes
  if (template === "rag-app") {
    imports.push('import { POST as ragQueryPOST } from "./api/rag/query";');
    imports.push('import { POST as ragIngestPOST } from "./api/rag/ingest";');
    mounts.push('app.post("/api/rag/query", ragQueryPOST);');
    mounts.push('app.post("/api/rag/ingest", ragIngestPOST);');
  } else if (enableRag) {
    imports.push('import { POST as ragIngestPOST } from "./api/rag/ingest";');
    mounts.push('app.post("/api/rag/ingest", ragIngestPOST);');
  }

  return `import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { registerSSR } from "@voltx/server";
import { loadEnv } from "@voltx/core";
${imports.join("\n")}

// Load environment variables
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
});

// ── Export for @hono/vite-dev-server (dev mode) ──────────────────────────
export default app;

// ── Start production server ──────────────────────────────────────────────
if (isProd) {
  const port = Number(process.env.PORT) || 3000;
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(\`\\n  ⚡ ${projectName} running at http://localhost:\${info.port}\\n\`);
  });
}
`;
}

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

function generateAppComponent(projectName: string, template: string, enableRag: boolean): string {
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
          ${projectName}
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

  const apiEndpoint = template === "agent-app" ? "/api/agent" : "/api/chat";
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

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const parsed = parseArgs(process.argv);

  console.log("");
  console.log(gradientBlock(BANNER, COLORS));
  console.log(`  ${ITALIC}${rgb(180, 180, 220, "The AI-first full-stack framework")}${RESET}`);
  console.log("");

  p.intro(rgb(0, 180, 255, "create-voltx-app"));

  // Non-interactive mode (--yes / --default)
  if (parsed.useDefault) {
    const projectName = parsed.projectName ?? "my-voltx-app";
    const template = parsed.template ?? "blank";
    const pm = (parsed.pkgManager as PkgManager) ?? detectPackageManager();
    const authChoice = parsed.auth ?? "none";
    const projectDir = path.resolve(process.cwd(), projectName);

    if (fs.existsSync(projectDir)) {
      p.cancel(`Directory "${projectName}" already exists.`);
      process.exit(1);
    }

    const s = p.spinner();
    s.start("Creating your VoltX project...");
    scaffold({
      projectDir, projectName, template, pm, authChoice,
      aiProvider: "cerebras", enableRag: false, embeddingProvider: "openai",
      selectedTools: template === "agent-app" ? ["calculator", "datetime"] : [],
      apiKeys: {},
      useShadcn: false,
    });
    s.stop("Project created!");

    s.start("Installing dependencies...");
    try { execSync(installCommand(pm), { cwd: projectDir, stdio: "ignore" }); s.stop("Dependencies installed!"); }
    catch { s.stop(`Failed to install — run ${installCommand(pm)} manually.`); }

    s.start("Initializing git...");
    const gitOk = tryGitInit(projectDir);
    s.stop(gitOk ? "Git initialized!" : "Git init skipped.");

    printOutro(projectName, pm, true);
    return;
  }

  // ── Interactive mode ─────────────────────────────────────────────────────

  // Helper to bail on cancel
  function bail(val: unknown): void {
    if (p.isCancel(val)) { p.cancel("Setup cancelled."); process.exit(0); }
  }

  // 1. Project name
  const projectName = await p.text({
    message: "What is your project name?",
    placeholder: "my-voltx-app",
    initialValue: parsed.projectName,
    validate: (val) => {
      if (!val.trim()) return "Project name is required";
      if (fs.existsSync(path.resolve(process.cwd(), val))) return `Directory "${val}" already exists`;
    },
  });
  bail(projectName);

  // 2. Template
  const template = await p.select({
    message: "Which template would you like?",
    initialValue: parsed.template,
    options: Object.entries(TEMPLATES).map(([value, { label, hint }]) => ({ value, label, hint })),
  });
  bail(template);

  const tmpl = template as string;
  const needsAI = tmpl !== "blank";
  const isRagTemplate = tmpl === "rag-app";

  // 3. AI Provider (skip for blank)
  let aiProvider = "cerebras";
  if (needsAI) {
    // For rag-app, only show embedding-capable providers
    const providerOptions = isRagTemplate
      ? ALL_PROVIDERS.filter((opt) => EMBEDDING_CAPABLE.has(opt.value))
      : ALL_PROVIDERS;

    const prov = await p.select({
      message: isRagTemplate
        ? "Which AI provider? (RAG requires embedding support)"
        : "Which AI provider?",
      initialValue: isRagTemplate ? "openai" : "cerebras",
      options: providerOptions,
    });
    bail(prov);
    aiProvider = prov as string;
  }

  // 4. Tools (agent-app only)
  let selectedTools: string[] = [];
  if (tmpl === "agent-app") {
    const tools = await p.multiselect({
      message: "Which tools should your agent have? (Space to toggle, Enter to confirm)",
      initialValues: ["calculator", "datetime"],
      options: Object.entries(AGENT_TOOLS).map(([value, { label, hint }]) => ({ value, label, hint })),
      required: true,
    });
    bail(tools);
    selectedTools = tools as string[];
  }

  // 5. Enable RAG? (chatbot/agent-app only, skip for rag-app and blank)
  let enableRag = isRagTemplate; // rag-app always has RAG
  if (tmpl === "chatbot" || tmpl === "agent-app") {
    const ragChoice = await p.confirm({
      message: tmpl === "agent-app"
        ? "Enable RAG? (adds a rag_search tool + /api/rag/ingest route)"
        : "Enable RAG? (chat will use your knowledge base for context)",
      initialValue: false,
    });
    bail(ragChoice);
    enableRag = ragChoice as boolean;
  }

  // 6. Embedding provider (if RAG enabled + main provider has no embeddings)
  let embeddingProvider = "openai";
  if (enableRag && !EMBEDDING_CAPABLE.has(aiProvider)) {
    const embedProv = await p.select({
      message: `${aiProvider} doesn't support embeddings. Pick an embedding provider:`,
      initialValue: "openai",
      options: ALL_PROVIDERS.filter((opt) => EMBEDDING_CAPABLE.has(opt.value)),
    });
    bail(embedProv);
    embeddingProvider = embedProv as string;
  } else if (enableRag) {
    embeddingProvider = aiProvider;
  }

  // 7. Auth
  const authChoice = await p.select({
    message: "Authentication?",
    initialValue: parsed.auth ?? "none",
    options: [
      { value: "better-auth", label: "Better Auth", hint: "Full-featured — email/password, OAuth, DB sessions" },
      { value: "jwt", label: "JWT", hint: "Stateless token-based auth" },
      { value: "none", label: "None", hint: "Skip auth setup" },
    ],
  });
  bail(authChoice);

  // 8. shadcn/ui
  const shadcnChoice = await p.confirm({
    message: "Include shadcn/ui? (pre-configured component library)",
    initialValue: false,
  });
  bail(shadcnChoice);

  // 9. Package manager
  const packageManager = await p.select({
    message: "Which package manager do you use?",
    initialValue: parsed.pkgManager ?? detectPackageManager(),
    options: [
      { value: "npm", label: "npm" },
      { value: "pnpm", label: "pnpm" },
      { value: "yarn", label: "yarn" },
      { value: "bun", label: "bun" },
    ],
  });
  bail(packageManager);

  const pm = packageManager as PkgManager;

  // ── Build the list of required API keys ──────────────────────────────────
  const scaffoldOpts: ScaffoldOptions = {
    projectDir: path.resolve(process.cwd(), projectName as string),
    projectName: projectName as string,
    template: tmpl,
    pm,
    authChoice: (authChoice as AuthChoice) ?? "none",
    aiProvider,
    enableRag,
    embeddingProvider,
    selectedTools,
    apiKeys: {},
    useShadcn: !!shadcnChoice,
  };

  const requiredKeys = collectRequiredKeys(scaffoldOpts);

  // 10. API keys toggle
  const apiKeys: Record<string, string> = {};
  if (requiredKeys.length > 0) {
    const enterKeys = await p.confirm({
      message: `You need ${requiredKeys.length} API key${requiredKeys.length > 1 ? "s" : ""}. Enter them now?`,
      initialValue: true,
    });
    bail(enterKeys);

    if (enterKeys) {
      for (const k of requiredKeys) {
        const val = await p.password({
          message: `${k.label} (${k.envVar}):`,
          mask: "▪",
          validate: () => undefined,
        });
        bail(val);
        if (val) apiKeys[k.envVar] = val as string;
      }
    } else {
      // Show summary of what keys they need
      p.note(
        requiredKeys.map((k) => `  ${k.envVar}  — ${k.label}`).join("\n"),
        "Add these to your .env file"
      );
    }
  }

  scaffoldOpts.apiKeys = apiKeys;

  // 11. Install
  const doInstall = await p.confirm({ message: "Install dependencies?", initialValue: true });
  bail(doInstall);

  // 12. Git
  const doGit = await p.confirm({ message: "Initialize a git repository?", initialValue: true });
  bail(doGit);

  // ── Execute ──────────────────────────────────────────────────────────────
  const s = p.spinner();

  s.start("Creating your VoltX project...");
  scaffold(scaffoldOpts);
  s.stop("Project created!");

  if (doInstall) {
    s.start("Installing dependencies...");
    try { execSync(installCommand(pm), { cwd: scaffoldOpts.projectDir, stdio: "ignore" }); s.stop("Dependencies installed!"); }
    catch { s.stop(`Failed to install — run ${installCommand(pm)} manually.`); }
  }

  if (doGit) {
    s.start("Initializing git...");
    const gitOk = tryGitInit(scaffoldOpts.projectDir);
    s.stop(gitOk ? "Git initialized!" : "Git init skipped.");
  }

  printOutro(projectName as string, pm, !!doInstall);
}

function printOutro(projectName: string, pm: PkgManager, installed: boolean) {
  const dimRule = rgb(60, 60, 80, "─".repeat(48));

  p.outro(rgb(120, 220, 180, "You're all set!"));

  console.log("");
  console.log(`  ${rgb(100, 180, 255, "Next steps:")}`);
  console.log(`  ${rgb(200, 200, 220, `  cd ${projectName}`)}`);
  if (!installed) console.log(`  ${rgb(200, 200, 220, `  ${installCommand(pm)}`)}`);
  console.log(`  ${rgb(200, 200, 220, `  ${runCommand(pm)} dev`)}`);
  console.log("");
  console.log(`  ${dimRule}`);
  console.log("");
  console.log(`  ${rgb(255, 200, 80, "☕")} ${ITALIC}${rgb(200, 180, 140, "Love VoltX? Support us:")}${RESET}`);
  console.log(`     ${rgb(255, 180, 100, "https://buymeacoffee.com/promptlyai")}`);
  console.log("");
  console.log(`  ${dimRule}`);
  console.log("");
  console.log(`  ${ITALIC}${rgb(140, 140, 170, "Docs: https://voltx.dev  •  GitHub: github.com/codewithshail/voltx")}${RESET}`);
  console.log(`  ${ITALIC}${rgb(100, 100, 130, "Made with ♥ by the Promptly AI Team")}${RESET}`);
  console.log("");
}

main().catch(console.error);

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
