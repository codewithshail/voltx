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

  // Frontend UI (public/index.html)
  if (template !== "blank") {
    fs.writeFileSync(path.join(targetDir, "public", "index.html"), generateFrontendHTML(name, template));
  }

  // .gitignore
  fs.writeFileSync(path.join(targetDir, ".gitignore"), "node_modules\ndist\n.env\n");

  // tsconfig already written above

  // Show the welcome banner
  printWelcomeBanner(name);
}

// ─── Frontend HTML generator ─────────────────────────────────────────────────

function generateFrontendHTML(projectName: string, template: string): string {
  const badge = template === "chatbot" ? "Chatbot" : template === "rag-app" ? "RAG App" : "Agent App";
  const accentClass = template === "rag-app" ? "emerald" : template === "agent-app" ? "purple" : "blue";

  const shell = (body: string) => `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
  <script src="https://cdn.tailwindcss.com/3.4.17"><\/script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', system-ui, sans-serif; }
    .msg-enter { animation: msgIn 0.25s ease-out; }
    @keyframes msgIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .typing-dot { animation: blink 1.4s infinite both; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes blink { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }
  </style>
</head>
<body class="h-full bg-gray-950 text-gray-100">
  <div id="app" class="h-full flex flex-col">
    <header class="flex-shrink-0 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm px-4 py-3">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold">V</div>
          <h1 class="text-lg font-semibold text-white">${projectName}</h1>
          <span class="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">${badge}</span>
        </div>
        <a href="https://github.com/codewithshail/voltx" target="_blank" class="text-gray-500 hover:text-gray-300 transition-colors text-sm">Built with VoltX</a>
      </div>
    </header>
    <main class="flex-1 overflow-hidden"><div class="h-full max-w-4xl mx-auto">
${body}
    </div></main>
  </div>
</body>
</html>`;

  if (template === "chatbot") return shell(chatbotBody());
  if (template === "rag-app") return shell(ragAppBody());
  if (template === "agent-app") return shell(agentAppBody());
  return "";
}

function chatbotBody(): string {
  return `      <div class="h-full flex flex-col">
        <div id="messages" class="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          <div class="text-center py-12">
            <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-500/20 flex items-center justify-center">
              <svg class="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            </div>
            <h2 class="text-xl font-semibold text-white mb-2">Start a conversation</h2>
            <p class="text-gray-500 text-sm">Type a message below to chat with your AI assistant.</p>
          </div>
        </div>
        <div class="flex-shrink-0 border-t border-gray-800 px-4 py-4">
          <form id="chatForm" class="flex gap-3">
            <input id="chatInput" type="text" placeholder="Type your message..." autocomplete="off" class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
            <button type="submit" id="sendBtn" class="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-xl transition-colors">Send</button>
          </form>
        </div>
      </div>
      <script>
        const messages=[], messagesEl=document.getElementById("messages"), form=document.getElementById("chatForm"), input=document.getElementById("chatInput"), sendBtn=document.getElementById("sendBtn");
        function addMsg(role,content){const d=document.createElement("div");d.className="msg-enter flex "+(role==="user"?"justify-end":"justify-start");const b=document.createElement("div");b.className=role==="user"?"max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-md bg-blue-600 text-white text-sm leading-relaxed":"max-w-[75%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-gray-800 text-gray-200 text-sm leading-relaxed";b.textContent=content;d.appendChild(b);const w=messagesEl.querySelector(".text-center.py-12");if(w)w.remove();messagesEl.appendChild(d);messagesEl.scrollTop=messagesEl.scrollHeight;return b}
        form.addEventListener("submit",async e=>{e.preventDefault();const text=input.value.trim();if(!text)return;messages.push({role:"user",content:text});addMsg("user",text);input.value="";sendBtn.disabled=true;try{const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages,conversationId:"default"})});if(!res.ok){addMsg("assistant","Error: "+res.status);sendBtn.disabled=false;return}const bubble=addMsg("assistant","");const reader=res.body.getReader();const dec=new TextDecoder();let full="";while(true){const{done,value}=await reader.read();if(done)break;const chunk=dec.decode(value,{stream:true});for(const line of chunk.split("\\n")){if(line.startsWith("data: ")){const d=line.slice(6);if(d==="[DONE]")continue;try{const p=JSON.parse(d);const t=p.textDelta||p.choices?.[0]?.delta?.content||p.content||p.text||"";full+=t;bubble.textContent=full;messagesEl.scrollTop=messagesEl.scrollHeight}catch{}}}}messages.push({role:"assistant",content:full})}catch(err){addMsg("assistant","Error: "+err.message)}sendBtn.disabled=false;input.focus()});
        input.focus();
      <\/script>`;
}

function ragAppBody(): string {
  return `      <div class="h-full flex flex-col md:flex-row">
        <div class="md:w-80 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-800 flex flex-col">
          <div class="px-4 py-3 border-b border-gray-800"><h2 class="text-sm font-semibold text-white flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>Ingest Documents</h2></div>
          <div class="flex-1 p-4 flex flex-col gap-3">
            <textarea id="ingestText" rows="6" placeholder="Paste text to ingest..." class="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 resize-none"></textarea>
            <button id="ingestBtn" onclick="ingestDoc()" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors">Ingest</button>
            <div id="ingestStatus" class="text-xs text-gray-500 hidden"></div>
            <div class="mt-auto pt-3 border-t border-gray-800"><p class="text-xs text-gray-600">Documents are chunked, embedded, and stored for retrieval.</p></div>
          </div>
        </div>
        <div class="flex-1 flex flex-col min-w-0">
          <div id="ragMessages" class="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            <div class="text-center py-12">
              <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-600/20 border border-emerald-500/20 flex items-center justify-center"><svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
              <h2 class="text-xl font-semibold text-white mb-2">Ask your documents</h2>
              <p class="text-gray-500 text-sm">Ingest documents on the left, then ask questions here.</p>
            </div>
          </div>
          <div class="flex-shrink-0 border-t border-gray-800 px-4 py-4">
            <form id="ragForm" class="flex gap-3">
              <input id="ragInput" type="text" placeholder="Ask about your documents..." autocomplete="off" class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors" />
              <button type="submit" id="ragSendBtn" class="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-xl transition-colors">Ask</button>
            </form>
          </div>
        </div>
      </div>
      <script>
        const ragEl=document.getElementById("ragMessages");
        function addRagMsg(role,c){const d=document.createElement("div");d.className="msg-enter flex "+(role==="user"?"justify-end":"justify-start");const b=document.createElement("div");b.className=role==="user"?"max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-md bg-emerald-600 text-white text-sm leading-relaxed":"max-w-[75%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-gray-800 text-gray-200 text-sm leading-relaxed";b.textContent=c;d.appendChild(b);const w=ragEl.querySelector(".text-center.py-12");if(w)w.remove();ragEl.appendChild(d);ragEl.scrollTop=ragEl.scrollHeight;return b}
        async function ingestDoc(){const text=document.getElementById("ingestText").value.trim();if(!text)return;const btn=document.getElementById("ingestBtn"),st=document.getElementById("ingestStatus");btn.disabled=true;btn.textContent="Ingesting...";st.className="text-xs text-yellow-400";st.textContent="Processing...";st.classList.remove("hidden");try{const res=await fetch("/api/rag/ingest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text})});const data=await res.json();if(res.ok){st.className="text-xs text-emerald-400";st.textContent="Ingested "+(data.chunks||0)+" chunks.";document.getElementById("ingestText").value=""}else{st.className="text-xs text-red-400";st.textContent="Error: "+(data.error||res.statusText)}}catch(e){st.className="text-xs text-red-400";st.textContent="Error: "+e.message}btn.disabled=false;btn.textContent="Ingest"}
        document.getElementById("ragForm").addEventListener("submit",async e=>{e.preventDefault();const input=document.getElementById("ragInput"),text=input.value.trim();if(!text)return;addRagMsg("user",text);input.value="";document.getElementById("ragSendBtn").disabled=true;try{const res=await fetch("/api/rag/query",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:text})});if(!res.ok){addRagMsg("assistant","Error: "+res.status);document.getElementById("ragSendBtn").disabled=false;return}const bubble=addRagMsg("assistant","");const reader=res.body.getReader();const dec=new TextDecoder();let full="";while(true){const{done,value}=await reader.read();if(done)break;const chunk=dec.decode(value,{stream:true});for(const line of chunk.split("\\n")){if(line.startsWith("data: ")){const d=line.slice(6);if(d==="[DONE]")continue;try{const p=JSON.parse(d);const t=p.textDelta||p.choices?.[0]?.delta?.content||p.content||p.text||"";full+=t;bubble.textContent=full;ragEl.scrollTop=ragEl.scrollHeight}catch{}}}};}catch(err){addRagMsg("assistant","Error: "+err.message)}document.getElementById("ragSendBtn").disabled=false;document.getElementById("ragInput").focus()});
        document.getElementById("ragInput").focus();
      <\/script>`;
}

function agentAppBody(): string {
  return `      <div class="h-full flex flex-col">
        <div id="agentMessages" class="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          <div class="text-center py-12">
            <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-orange-500/20 border border-purple-500/20 flex items-center justify-center"><svg class="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg></div>
            <h2 class="text-xl font-semibold text-white mb-2">AI Agent</h2>
            <p class="text-gray-500 text-sm">Your agent can use tools to answer questions accurately.</p>
          </div>
        </div>
        <div class="flex-shrink-0 border-t border-gray-800 px-4 py-4">
          <form id="agentForm" class="flex gap-3">
            <input id="agentInput" type="text" placeholder="Ask the agent anything..." autocomplete="off" class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors" />
            <button type="submit" id="agentSendBtn" class="px-5 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-xl transition-colors">Run</button>
          </form>
        </div>
      </div>
      <script>
        const agentEl=document.getElementById("agentMessages");
        function addAgentMsg(role,c,isStep){const d=document.createElement("div");d.className="msg-enter flex "+(role==="user"?"justify-end":"justify-start");const b=document.createElement("div");if(isStep){b.className="max-w-[85%] px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-xs text-gray-400 font-mono"}else{b.className=role==="user"?"max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-md bg-purple-600 text-white text-sm leading-relaxed":"max-w-[75%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-gray-800 text-gray-200 text-sm leading-relaxed whitespace-pre-wrap"}b.textContent=c;d.appendChild(b);const w=agentEl.querySelector(".text-center.py-12");if(w)w.remove();agentEl.appendChild(d);agentEl.scrollTop=agentEl.scrollHeight;return b}
        function addThinking(){const d=document.createElement("div");d.id="thinking";d.className="msg-enter flex justify-start";d.innerHTML='<div class="px-4 py-2.5 rounded-2xl rounded-bl-md bg-gray-800 flex items-center gap-2 text-sm text-gray-400"><svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>Agent is thinking...</div>';agentEl.appendChild(d);agentEl.scrollTop=agentEl.scrollHeight}
        function removeThinking(){const t=document.getElementById("thinking");if(t)t.remove()}
        document.getElementById("agentForm").addEventListener("submit",async e=>{e.preventDefault();const input=document.getElementById("agentInput"),text=input.value.trim();if(!text)return;addAgentMsg("user",text);input.value="";document.getElementById("agentSendBtn").disabled=true;addThinking();try{const res=await fetch("/api/agent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:text})});removeThinking();if(!res.ok){const err=await res.json().catch(()=>({}));addAgentMsg("assistant","Error: "+(err.error||res.statusText));document.getElementById("agentSendBtn").disabled=false;return}const data=await res.json();if(data.steps&&data.steps.length>0){for(const s of data.steps){const name=s.tool||s.name||"tool";const inp=typeof s.input==="string"?s.input:JSON.stringify(s.input||{});const out=typeof s.output==="string"?s.output:JSON.stringify(s.output||{});addAgentMsg("assistant","🔧 "+name+"("+inp+")\\n→ "+out.slice(0,300),true)}}addAgentMsg("assistant",data.content||"No response.")}catch(err){removeThinking();addAgentMsg("assistant","Error: "+err.message)}document.getElementById("agentSendBtn").disabled=false;input.focus()});
        document.getElementById("agentInput").focus();
      <\/script>`;
}

if (typeof require !== "undefined" && require.main === module && process.argv[1]?.includes("create")) {
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
