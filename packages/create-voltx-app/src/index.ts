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

// ─── Template definitions ────────────────────────────────────────────────────

const VOLTX_VERSION = "^0.3.0";

const TEMPLATES: Record<string, { label: string; hint: string; deps: Record<string, string> }> = {
  blank: {
    label: "Blank",
    hint: "Minimal server with @voltx/core + file-based routing",
    deps: {
      "@voltx/core": VOLTX_VERSION,
      "@voltx/server": VOLTX_VERSION,
    },
  },
  chatbot: {
    label: "Chatbot",
    hint: "Streaming chat with AI + memory + file-based routes",
    deps: {
      "@voltx/core": VOLTX_VERSION,
      "@voltx/ai": VOLTX_VERSION,
      "@voltx/server": VOLTX_VERSION,
      "@voltx/memory": VOLTX_VERSION,
    },
  },
  "rag-app": {
    label: "RAG App",
    hint: "Document Q&A with vector DB + streaming + file-based routes",
    deps: {
      "@voltx/core": VOLTX_VERSION,
      "@voltx/ai": VOLTX_VERSION,
      "@voltx/server": VOLTX_VERSION,
      "@voltx/rag": VOLTX_VERSION,
      "@voltx/db": VOLTX_VERSION,
    },
  },
  "agent-app": {
    label: "Agent App",
    hint: "AI agent with tools, memory, DB + file-based routes",
    deps: {
      "@voltx/core": VOLTX_VERSION,
      "@voltx/ai": VOLTX_VERSION,
      "@voltx/server": VOLTX_VERSION,
      "@voltx/agents": VOLTX_VERSION,
      "@voltx/memory": VOLTX_VERSION,
    },
  },
};

// ─── Provider env key mapping ────────────────────────────────────────────────

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

// ─── Package manager detection ───────────────────────────────────────────────

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

// ─── README generation ───────────────────────────────────────────────────────

function generateReadme(projectName: string, template: string, pm: PkgManager): string {
  return `# ${projectName}

Built with [VoltX](https://voltx.dev) — the AI-first full-stack framework.

Template: **${template}**

## Getting Started

\`\`\`bash
# Install dependencies
${installCommand(pm)}

# Start development server
${runCommand(pm)} dev

# Build for production
${runCommand(pm)} build

# Start production server
${runCommand(pm)} start
\`\`\`

## Generate Code

\`\`\`bash
# Generate a new API route
npx voltx generate route api/users

# Generate a new agent
npx voltx generate agent assistant

# Generate a new tool
npx voltx generate tool search

# Generate a new background job
npx voltx generate job cleanup
\`\`\`

## Project Structure

\`\`\`
${projectName}/
├── src/
│   ├── routes/           # File-based API routes
│   ├── agents/           # AI agent definitions
│   ├── tools/            # Custom tools for agents
│   ├── jobs/             # Background jobs
│   └── index.ts          # App entry point
├── voltx.config.ts       # VoltX configuration
├── .env.example          # Environment variables template
├── tsconfig.json
└── package.json
\`\`\`

## Configuration

Edit \`voltx.config.ts\` to configure your AI provider, database, and auth settings.

## Learn More

- [VoltX Documentation](https://voltx.dev)
- [GitHub](https://github.com/codewithshail/voltx)
`;
}

// ─── Agent tool definitions ──────────────────────────────────────────────────

interface AgentToolDef {
  label: string;
  hint: string;
  envKey: string;       // empty = no API key needed
  envHint: string;      // placeholder for .env
}

const AGENT_TOOLS: Record<string, AgentToolDef> = {
  calculator: { label: "Calculator", hint: "Math expressions — no API key needed", envKey: "", envHint: "" },
  datetime: { label: "Date & Time", hint: "Current date/time/timezone — no API key needed", envKey: "", envHint: "" },
  "web-search-tavily": { label: "Web Search (Tavily)", hint: "AI-optimized search — 1,000 free credits/month", envKey: "TAVILY_API_KEY", envHint: "tvly-..." },
  "web-search-serper": { label: "Web Search (Serper)", hint: "Google search — 2,500 free searches/month", envKey: "SERPER_API_KEY", envHint: "" },
  weather: { label: "Weather (OpenWeatherMap)", hint: "Current weather — 1,000 free calls/day", envKey: "OPENWEATHER_API_KEY", envHint: "" },
  news: { label: "News (NewsAPI)", hint: "Top headlines & search — free for dev", envKey: "NEWS_API_KEY", envHint: "" },
};

// ─── Scaffold logic ──────────────────────────────────────────────────────────

function scaffold(projectDir: string, projectName: string, template: string, pm: PkgManager, authChoice: AuthChoice = "none", aiProvider = "cerebras", apiKey = "", selectedTools: string[] = ["calculator", "datetime"], toolApiKeys: Record<string, string> = {}): void {
  const tmpl = TEMPLATES[template] ?? TEMPLATES["blank"];

  fs.mkdirSync(projectDir, { recursive: true });

  // Build dependencies — start with template deps
  const deps: Record<string, string> = { ...tmpl.deps };

  // Add auth dependencies based on choice
  if (authChoice === "better-auth") {
    deps["@voltx/auth"] = VOLTX_VERSION;
    deps["better-auth"] = "^1.5.0";
  } else if (authChoice === "jwt") {
    deps["@voltx/auth"] = VOLTX_VERSION;
    deps["jose"] = "^6.0.0";
  }

  // package.json
  const pkg = {
    name: projectName,
    version: "0.1.0",
    private: true,
    scripts: { dev: "voltx dev", build: "voltx build", start: "voltx start" },
    dependencies: { ...deps, "@voltx/cli": VOLTX_VERSION },
    devDependencies: { typescript: "^5.7.0", tsx: "^4.21.0", tsup: "^8.0.0", "@types/node": "^22.0.0" },
  };
  fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify(pkg, null, 2));

  // voltx.config.ts — template-specific
  fs.writeFileSync(path.join(projectDir, "voltx.config.ts"), generateConfig(projectName, template, authChoice, aiProvider));

  // tsconfig.json
  fs.writeFileSync(
    path.join(projectDir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true, esModuleInterop: true, skipLibCheck: true, outDir: "dist" }, include: ["src", "voltx.config.ts"] }, null, 2)
  );

  // src/index.ts — always the same entry point
  fs.mkdirSync(path.join(projectDir, "src", "routes", "api"), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, "src", "index.ts"),
    `import { createApp } from "@voltx/core";\nimport config from "../voltx.config";\n\nconst app = createApp(config);\napp.start();\n`
  );

  // src/routes/index.ts — health check (all templates)
  fs.writeFileSync(
    path.join(projectDir, "src", "routes", "index.ts"),
    `// GET / — Health check\nimport type { Context } from "@voltx/server";\n\nexport function GET(c: Context) {\n  return c.json({ name: "${projectName}", status: "ok" });\n}\n`
  );

  // Template-specific route files
  if (template === "chatbot" || template === "agent-app") {
    const modelStr = `${aiProvider}:${PROVIDER_MODELS[aiProvider] ?? "llama3.1-8b"}`;
    fs.writeFileSync(
      path.join(projectDir, "src", "routes", "api", "chat.ts"),
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
    model: "${modelStr}",
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

  // Agent-specific files (agent definition + tool + agent route)
  if (template === "agent-app") {
    const modelStr = `${aiProvider}:${PROVIDER_MODELS[aiProvider] ?? "llama3.1-8b"}`;
    fs.mkdirSync(path.join(projectDir, "src", "agents"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "src", "tools"), { recursive: true });

    // Generate tool files based on user selection
    const toolImports: string[] = [];
    const toolNames: string[] = [];

    for (const toolId of selectedTools) {
      if (toolId === "calculator") {
        toolImports.push('import { calculatorTool } from "../tools/calculator";');
        toolNames.push("calculatorTool");
        fs.writeFileSync(
          path.join(projectDir, "src", "tools", "calculator.ts"),
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
      }

      if (toolId === "datetime") {
        toolImports.push('import { datetimeTool } from "../tools/datetime";');
        toolNames.push("datetimeTool");
        fs.writeFileSync(
          path.join(projectDir, "src", "tools", "datetime.ts"),
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
      }

      if (toolId === "web-search-tavily") {
        toolImports.push('import { tavilySearchTool } from "../tools/web-search-tavily";');
        toolNames.push("tavilySearchTool");
        fs.writeFileSync(
          path.join(projectDir, "src", "tools", "web-search-tavily.ts"),
          `// Web Search tool — powered by Tavily (https://tavily.com)
// Free tier: 1,000 API credits/month — sign up at https://app.tavily.com
import type { Tool } from "@voltx/agents";

export const tavilySearchTool: Tool = {
  name: "web_search_tavily",
  description: "Search the web for current information using Tavily. Returns relevant results with titles, URLs, and content snippets. Use this for any question about recent events, facts, or topics you're unsure about.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query" },
    },
    required: ["query"],
  },
  async execute(args: { query: string }) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return "Error: TAVILY_API_KEY not set in .env";

    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: args.query,
          search_depth: "basic",
          max_results: 5,
        }),
      });

      if (!res.ok) return \`Search error: \${res.status} \${res.statusText}\`;
      const data = await res.json() as { results: Array<{ title: string; url: string; content: string }> };

      return data.results
        .map((r, i) => \`[\${i + 1}] \${r.title}\\n    \${r.url}\\n    \${r.content.slice(0, 200)}\`)
        .join("\\n\\n") || "No results found.";
    } catch (err) {
      return \`Search failed: \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`
        );
      }

      if (toolId === "web-search-serper") {
        toolImports.push('import { serperSearchTool } from "../tools/web-search-serper";');
        toolNames.push("serperSearchTool");
        fs.writeFileSync(
          path.join(projectDir, "src", "tools", "web-search-serper.ts"),
          `// Web Search tool — powered by Serper (https://serper.dev)
// Free tier: 2,500 searches/month — sign up at https://serper.dev
import type { Tool } from "@voltx/agents";

export const serperSearchTool: Tool = {
  name: "web_search_serper",
  description: "Search Google for current information using Serper. Returns relevant results with titles, URLs, and snippets. Use this for any question about recent events, facts, or topics you're unsure about.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query" },
    },
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

      return (data.organic || [])
        .map((r, i) => \`[\${i + 1}] \${r.title}\\n    \${r.link}\\n    \${r.snippet}\`)
        .join("\\n\\n") || "No results found.";
    } catch (err) {
      return \`Search failed: \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`
        );
      }

      if (toolId === "weather") {
        toolImports.push('import { weatherTool } from "../tools/weather";');
        toolNames.push("weatherTool");
        fs.writeFileSync(
          path.join(projectDir, "src", "tools", "weather.ts"),
          `// Weather tool — powered by OpenWeatherMap (https://openweathermap.org)
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
      const data = await res.json() as {
        name: string;
        main: { temp: number; feels_like: number; humidity: number };
        weather: Array<{ description: string }>;
        wind: { speed: number };
      };

      return \`Weather in \${data.name}: \${data.main.temp}\${unitSymbol} (feels like \${data.main.feels_like}\${unitSymbol}), \${data.weather[0]?.description || "N/A"}, humidity \${data.main.humidity}%, wind \${data.wind.speed} \${units === "imperial" ? "mph" : "m/s"}\`;
    } catch (err) {
      return \`Weather fetch failed: \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`
        );
      }

      if (toolId === "news") {
        toolImports.push('import { newsTool } from "../tools/news";');
        toolNames.push("newsTool");
        fs.writeFileSync(
          path.join(projectDir, "src", "tools", "news.ts"),
          `// News tool — powered by NewsAPI (https://newsapi.org)
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
        const country = args.country || "us";
        url = \`https://newsapi.org/v2/top-headlines?country=\${country}&pageSize=5&apiKey=\${apiKey}\`;
      }

      const res = await fetch(url);
      if (!res.ok) return \`News error: \${res.status} \${res.statusText}\`;
      const data = await res.json() as { articles: Array<{ title: string; source: { name: string }; url: string; description: string }> };

      return (data.articles || [])
        .map((a, i) => \`[\${i + 1}] \${a.title}\\n    Source: \${a.source?.name || "Unknown"} — \${a.url}\\n    \${(a.description || "").slice(0, 150)}\`)
        .join("\\n\\n") || "No news found.";
    } catch (err) {
      return \`News fetch failed: \${err instanceof Error ? err.message : String(err)}\`;
    }
  },
};
`
        );
      }
    }

    // Build tool instruction list for the agent
    const toolDescriptions = selectedTools.map((t) => AGENT_TOOLS[t]?.label || t).join(", ");

    // Agent definition
    fs.writeFileSync(
      path.join(projectDir, "src", "agents", "assistant.ts"),
      `// AI Agent — autonomous assistant with tools
import { createAgent } from "@voltx/agents";
${toolImports.join("\n")}

export const assistant = createAgent({
  name: "assistant",
  model: "${modelStr}",
  instructions: "You are a helpful AI assistant with access to tools: ${toolDescriptions}. Use them when needed to answer questions accurately.",
  tools: [${toolNames.join(", ")}],
  maxIterations: 5,
});
`
    );

    // Agent API route
    fs.writeFileSync(
      path.join(projectDir, "src", "routes", "api", "agent.ts"),
      `// POST /api/agent — Run the AI agent
import type { Context } from "@voltx/server";
import { assistant } from "../../agents/assistant";

export async function POST(c: Context) {
  const { input } = await c.req.json();

  if (!input || typeof input !== "string") {
    return c.json({ error: "Missing 'input' field" }, 400);
  }

  const result = await assistant.run(input);
  return c.json({
    content: result.content,
    steps: result.steps,
    finishReason: result.finishReason,
  });
}
`
    );
  }

  if (template === "rag-app") {
    const modelStr = `${aiProvider}:${PROVIDER_MODELS[aiProvider] ?? "llama3.1-8b"}`;
    // Embeddings: use the chosen provider if it supports embeddings, otherwise fall back to OpenAI
    const EMBEDDING_PROVIDERS: Record<string, string> = {
      openai: "openai:text-embedding-3-small",
      google: "google:text-embedding-004",
      ollama: "ollama:nomic-embed-text",
    };
    const embedModel = EMBEDDING_PROVIDERS[aiProvider] ?? "openai:text-embedding-3-small";
    const needsOpenAIForEmbeddings = !EMBEDDING_PROVIDERS[aiProvider];

    fs.mkdirSync(path.join(projectDir, "src", "routes", "api", "rag"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "src", "routes", "api", "rag", "query.ts"),
      `// POST /api/rag/query — Query documents with RAG
import type { Context } from "@voltx/server";
import { streamText } from "@voltx/ai";
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const vectorStore = createVectorStore(); // swap to "pinecone" or "pgvector" for production
const embedder = createEmbedder({ model: "${embedModel}" });${needsOpenAIForEmbeddings ? " // Note: embeddings use OpenAI (your provider doesn't support embeddings)" : ""}
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
`
    );
    fs.writeFileSync(
      path.join(projectDir, "src", "routes", "api", "rag", "ingest.ts"),
      `// POST /api/rag/ingest — Ingest documents into the vector store
import type { Context } from "@voltx/server";
import { createRAGPipeline, createEmbedder } from "@voltx/rag";
import { createVectorStore } from "@voltx/db";

const vectorStore = createVectorStore();
const embedder = createEmbedder({ model: "${embedModel}" });${needsOpenAIForEmbeddings ? " // Note: embeddings use OpenAI" : ""}
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

    // If the chosen provider doesn't support embeddings, add OPENAI_API_KEY to .env
    if (needsOpenAIForEmbeddings) {
      // We'll handle this in the .env generation below
    }
  }

  // public/ directory for static files
  fs.mkdirSync(path.join(projectDir, "public"), { recursive: true });

  // Auth route files
  if (authChoice === "better-auth") {
    // Better Auth needs a catch-all route at /api/auth/* for sign-up, sign-in, OAuth, etc.
    fs.mkdirSync(path.join(projectDir, "src", "routes", "api", "auth"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "src", "routes", "api", "auth", "[...path].ts"),
      `// ALL /api/auth/* — Better Auth handler (sign-up, sign-in, OAuth, sessions)
import type { Context } from "@voltx/server";
import { auth } from "../../../lib/auth";
import { createAuthHandler } from "@voltx/auth";

const handler = createAuthHandler(auth);

export const GET = (c: Context) => handler(c);
export const POST = (c: Context) => handler(c);
`
    );
    fs.mkdirSync(path.join(projectDir, "src", "lib"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "src", "lib", "auth.ts"),
      `// Auth configuration — Better Auth with DB-backed sessions
import { createAuth, createAuthMiddleware } from "@voltx/auth";

export const auth = createAuth("better-auth", {
  database: process.env.DATABASE_URL!,
  emailAndPassword: true,
  // Uncomment to add OAuth providers:
  // socialProviders: {
  //   github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! },
  //   google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
  // },
});

export const authMiddleware = createAuthMiddleware({
  provider: auth,
  publicPaths: ["/api/auth", "/api/health", "/"],
});
`
    );
  } else if (authChoice === "jwt") {
    fs.mkdirSync(path.join(projectDir, "src", "lib"), { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "src", "lib", "auth.ts"),
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
      path.join(projectDir, "src", "routes", "api", "auth.ts"),
      `// POST /api/auth/login — Example JWT login route
import type { Context } from "@voltx/server";
import { jwt } from "../../lib/auth";

export async function POST(c: Context) {
  const { email, password } = await c.req.json();

  // TODO: Replace with your own user validation logic
  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  // Sign a JWT token
  const token = await jwt.sign({ sub: email, email });
  return c.json({ token });
}
`
    );
  }

  // .env.example — template-specific
  fs.writeFileSync(path.join(projectDir, ".env.example"), generateEnvExample(template, authChoice, aiProvider));

  // .env — real env file with the API key pre-filled (gitignored)
  const envKey = PROVIDER_ENV_KEYS[aiProvider];
  let envContent = "";
  if (envKey && apiKey) {
    envContent += `${envKey}=${apiKey}\n`;
  } else if (envKey) {
    envContent += `# ${envKey}=your-key-here\n`;
  }
  // RAG apps using providers without embeddings need an OpenAI key too
  if (template === "rag-app" && !["openai", "google", "ollama"].includes(aiProvider)) {
    envContent += `# OPENAI_API_KEY=sk-... (needed for embeddings — ${aiProvider} doesn't support them)\n`;
  }
  // Tool API keys (agent-app)
  if (template === "agent-app" && selectedTools.length > 0) {
    const toolKeysNeeded = selectedTools
      .map((t) => AGENT_TOOLS[t])
      .filter((d) => d?.envKey);
    if (toolKeysNeeded.length > 0) {
      envContent += "\n# ─── Tool API Keys ───────────────────────────────\n";
      for (const def of toolKeysNeeded) {
        const val = toolApiKeys[def.envKey];
        if (val) {
          envContent += `${def.envKey}=${val}\n`;
        } else {
          envContent += `# ${def.envKey}=\n`;
        }
      }
    }
  }
  envContent += "PORT=3000\nNODE_ENV=development\n";
  fs.writeFileSync(path.join(projectDir, ".env"), envContent);

  // .gitignore
  fs.writeFileSync(path.join(projectDir, ".gitignore"), "node_modules\ndist\n.env\n");

  // README.md
  fs.writeFileSync(path.join(projectDir, "README.md"), generateReadme(projectName, template, pm));
}

function generateConfig(projectName: string, template: string, authChoice: AuthChoice = "none", aiProvider = "cerebras"): string {
  const hasDb = template === "rag-app" || template === "agent-app" || authChoice === "better-auth";
  const provider = aiProvider;
  const model = PROVIDER_MODELS[aiProvider] ?? "llama3.1-8b";

  let config = `import { defineConfig } from "@voltx/core";\n\nexport default defineConfig({\n  name: "${projectName}",\n  port: 3000,\n  ai: {\n    provider: "${provider}",\n    model: "${model}",\n  },`;

  if (hasDb) {
    config += `\n  db: {\n    url: process.env.DATABASE_URL,\n  },`;
  }

  if (authChoice !== "none") {
    config += `\n  auth: {\n    provider: "${authChoice}",\n  },`;
  }

  config += `\n  server: {\n    routesDir: "src/routes",\n    staticDir: "public",\n    cors: true,\n  },\n});\n`;

  return config;
}

function generateEnvExample(template: string, authChoice: AuthChoice = "none", aiProvider = "cerebras"): string {
  let env = "";

  const envKey = PROVIDER_ENV_KEYS[aiProvider];
  if (envKey) {
    env += `# ─── LLM Provider ────────────────────────────────\n${envKey}=your-key-here\n\n`;
  } else {
    env += "# ─── LLM Provider (Ollama — no key needed) ───────\n# OLLAMA_BASE_URL=http://localhost:11434\n\n";
  }

  if (template === "rag-app") {
    env += "# ─── Database (Neon Postgres) ────────────────────\nDATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require\n\n";
    env += "# ─── Vector Database (Pinecone) ──────────────────\nPINECONE_API_KEY=pc-...\nPINECONE_INDEX=voltx-embeddings\n\n";
  } else if (template === "agent-app") {
    env += "# ─── Database (Neon Postgres — optional) ─────────\nDATABASE_URL=\n\n";
    env += "# ─── Tool API Keys (add keys for tools you selected) ─\n";
    env += "# TAVILY_API_KEY=tvly-...       (Web Search — https://tavily.com)\n";
    env += "# SERPER_API_KEY=               (Google Search — https://serper.dev)\n";
    env += "# OPENWEATHER_API_KEY=          (Weather — https://openweathermap.org/api)\n";
    env += "# NEWS_API_KEY=                 (News — https://newsapi.org)\n\n";
  }

  // Auth env vars
  if (authChoice === "better-auth") {
    env += "# ─── Auth (Better Auth) ──────────────────────────\nBETTER_AUTH_SECRET=your-secret-key-min-32-chars-here\nBETTER_AUTH_URL=http://localhost:3000\n";
    if (template !== "rag-app" && template !== "agent-app") {
      env += "DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require\n";
    }
    env += "# GITHUB_CLIENT_ID=\n# GITHUB_CLIENT_SECRET=\n# GOOGLE_CLIENT_ID=\n# GOOGLE_CLIENT_SECRET=\n\n";
  } else if (authChoice === "jwt") {
    env += "# ─── Auth (JWT) ──────────────────────────────────\nJWT_SECRET=your-jwt-secret-key\n\n";
  }

  env += "# ─── App ─────────────────────────────────────────\nPORT=3000\nNODE_ENV=development\n";
  return env;
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
    scaffold(projectDir, projectName, template, pm, authChoice);
    s.stop("Project created!");

    s.start("Installing dependencies...");
    try {
      execSync(installCommand(pm), { cwd: projectDir, stdio: "ignore" });
      s.stop("Dependencies installed!");
    } catch {
      s.stop(`Failed to install — run ${installCommand(pm)} manually.`);
    }

    s.start("Initializing git...");
    const gitOk = tryGitInit(projectDir);
    s.stop(gitOk ? "Git initialized!" : "Git init skipped (git not available).");

    printOutro(projectName, pm, true);
    return;
  }

  // Interactive mode
  const project = await p.group(
    {
      name: () =>
        p.text({
          message: "What is your project name?",
          placeholder: "my-voltx-app",
          initialValue: parsed.projectName,
          validate: (val) => {
            if (!val.trim()) return "Project name is required";
            if (fs.existsSync(path.resolve(process.cwd(), val))) return `Directory "${val}" already exists`;
          },
        }),
      template: () =>
        p.select({
          message: "Which template would you like?",
          initialValue: parsed.template,
          options: Object.entries(TEMPLATES).map(([value, { label, hint }]) => ({
            value,
            label,
            hint,
          })),
        }),
      aiProvider: ({ results }) => {
        const tmpl = results.template as string;
        if (tmpl === "blank") return Promise.resolve("cerebras");

        // RAG needs embeddings — only OpenAI, Google, and Ollama support them
        const isRag = tmpl === "rag-app";

        const allProviders = [
          { value: "cerebras", label: "Cerebras", hint: "Free tier, fast inference (Llama models)" },
          { value: "openai", label: "OpenAI", hint: "GPT-4o, GPT-4o-mini" },
          { value: "anthropic", label: "Anthropic", hint: "Claude Sonnet, Claude Opus" },
          { value: "google", label: "Google AI", hint: "Gemini Pro, Gemini Flash" },
          { value: "openrouter", label: "OpenRouter", hint: "Access 100+ models via one API" },
          { value: "ollama", label: "Ollama", hint: "Local models, no API key needed" },
        ];

        const EMBEDDING_PROVIDERS = ["openai", "google", "ollama"];
        const options = isRag
          ? allProviders.filter((opt) => EMBEDDING_PROVIDERS.includes(opt.value))
          : allProviders;

        return p.select({
          message: isRag
            ? "Which AI provider? (RAG requires embedding support)"
            : "Which AI provider?",
          initialValue: isRag ? "openai" : "cerebras",
          options,
        });
      },
      apiKey: ({ results }) => {
        const prov = results.aiProvider as string;
        if (prov === "ollama") return Promise.resolve("");
        const envVar = PROVIDER_ENV_KEYS[prov] ?? `${prov.toUpperCase()}_API_KEY`;
        return p.password({
          message: `Enter your ${prov} API key (${envVar}):`,
          mask: "▪",
          validate: () => undefined, // optional
        });
      },
      tools: ({ results }) => {
        if (results.template !== "agent-app") return Promise.resolve(["calculator", "datetime"]);
        return p.multiselect({
          message: "Which tools should your agent have?",
          initialValues: ["calculator", "datetime"],
          options: Object.entries(AGENT_TOOLS).map(([value, { label, hint }]) => ({
            value,
            label,
            hint,
          })),
          required: true,
        });
      },
      auth: () =>
        p.select({
          message: "Authentication?",
          initialValue: parsed.auth ?? "none",
          options: [
            { value: "better-auth", label: "Better Auth", hint: "Full-featured — email/password, OAuth, DB sessions" },
            { value: "jwt", label: "JWT", hint: "Stateless token-based auth" },
            { value: "none", label: "None", hint: "Skip auth setup" },
          ],
        }),
      packageManager: () =>
        p.select({
          message: "Which package manager do you use?",
          initialValue: parsed.pkgManager ?? detectPackageManager(),
          options: [
            { value: "npm", label: "npm" },
            { value: "pnpm", label: "pnpm" },
            { value: "yarn", label: "yarn" },
            { value: "bun", label: "bun" },
          ],
        }),
      install: () =>
        p.confirm({
          message: "Install dependencies?",
          initialValue: true,
        }),
      gitInit: () =>
        p.confirm({
          message: "Initialize a git repository?",
          initialValue: true,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Setup cancelled.");
        process.exit(0);
      },
    }
  );

  const s = p.spinner();
  const projectName = project.name as string;
  const template = project.template as string;
  const pm = project.packageManager as PkgManager;
  const authChoice = (project.auth as AuthChoice) ?? "none";
  const aiProvider = (project.aiProvider as string) ?? "cerebras";
  const apiKey = (project.apiKey as string) ?? "";
  const selectedTools = (project.tools as string[]) ?? ["calculator", "datetime"];
  const projectDir = path.resolve(process.cwd(), projectName);

  // Ask for API keys for tools that need them (only for agent-app)
  const toolApiKeys: Record<string, string> = {};
  if (template === "agent-app") {
    for (const toolId of selectedTools) {
      const def = AGENT_TOOLS[toolId];
      if (def?.envKey) {
        const key = await p.password({
          message: `Enter your ${def.label} API key (${def.envKey}):`,
          mask: "▪",
          validate: () => undefined,
        });
        if (p.isCancel(key)) {
          p.cancel("Setup cancelled.");
          process.exit(0);
        }
        if (key) toolApiKeys[def.envKey] = key as string;
      }
    }
  }

  // Scaffold
  s.start("Creating your VoltX project...");
  scaffold(projectDir, projectName, template, pm, authChoice, aiProvider, apiKey, selectedTools, toolApiKeys);
  s.stop("Project created!");

  // Install deps
  if (project.install) {
    s.start("Installing dependencies...");
    try {
      execSync(installCommand(pm), { cwd: projectDir, stdio: "ignore" });
      s.stop("Dependencies installed!");
    } catch {
      s.stop(`Failed to install — run ${installCommand(pm)} manually.`);
    }
  }

  // Git init
  if (project.gitInit) {
    s.start("Initializing git...");
    const gitOk = tryGitInit(projectDir);
    s.stop(gitOk ? "Git initialized!" : "Git init skipped (git not available).");
  }

  printOutro(projectName, pm, !!project.install);
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
