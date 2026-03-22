// @voltx/core — Framework engine
// Wires together: server, AI, DB, auth, plugins — into a single `createApp().start()` call.

import {
  createServer,
  type VoltxServer,
  type CorsConfig,
} from "@voltx/server";

// ─── Env ─────────────────────────────────────────────────────────────────────

export { loadEnv, getPublicEnv } from "./env.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VoltxConfig {
  /** Application name */
  name?: string;
  /** Port for the dev server */
  port?: number;
  /** AI provider configuration */
  ai?: AIProviderConfig;
  /** Database configuration */
  db?: DatabaseConfig;
  /** Auth configuration */
  auth?: AuthConfig;
  /** Server configuration overrides */
  server?: ServerConfigOverrides;
  /** Plugin list */
  plugins?: VoltxPlugin[];
}

export interface ServerConfigOverrides {
  /** Hostname to bind to (default: "0.0.0.0") */
  hostname?: string;
  /** Directory to scan for file-based routes (default: "api") */
  routesDir?: string;
  /** Directory for static files (default: "public") */
  staticDir?: string;
  /** Enable CORS (default: true) */
  cors?: boolean | CorsConfig;
  /** Enable request logging */
  logger?: boolean;
}

export interface AIProviderConfig {
  /** Default provider: 'openai' | 'anthropic' | 'google' | 'cerebras' | 'openrouter' | 'ollama' */
  provider: string;
  /** Model identifier */
  model?: string;
  /** API key (reads from env if not set) */
  apiKey?: string;
  /** Base URL for custom/self-hosted providers */
  baseUrl?: string;
}

export interface DatabaseConfig {
  /** Relational DB connection string */
  url?: string;
  /** Vector DB provider: 'pinecone' | 'qdrant' | 'chroma' | 'pgvector' */
  vectorProvider?: string;
  /** Vector DB connection config */
  vectorUrl?: string;
}

export interface AuthConfig {
  /** Auth provider: 'better-auth' | 'jwt' | 'api-key' */
  provider: string;
  /** Provider-specific options */
  options?: Record<string, unknown>;
}

export interface VoltxPlugin {
  name: string;
  setup: (ctx: VoltxContext) => void | Promise<void>;
}

export interface VoltxContext {
  config: VoltxConfig;
  logger: Logger;
  server: VoltxServer;
}

export interface Logger {
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  debug: (msg: string, ...args: unknown[]) => void;
}

// ─── Logger ──────────────────────────────────────────────────────────────────

export function createLogger(prefix = "voltx"): Logger {
  return {
    info: (msg, ...args) => console.log(`[${prefix}] ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`[${prefix}] ⚠ ${msg}`, ...args),
    error: (msg, ...args) => console.error(`[${prefix}] ✖ ${msg}`, ...args),
    debug: (msg, ...args) => console.debug(`[${prefix}] ${msg}`, ...args),
  };
}

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: VoltxConfig = {
  name: "voltx-app",
  port: 3000,
};

export function defineConfig(config: Partial<VoltxConfig>): VoltxConfig {
  return { ...DEFAULT_CONFIG, ...config };
}

// ─── App ─────────────────────────────────────────────────────────────────────

export class VoltxApp {
  public config: VoltxConfig;
  public logger: Logger;
  public server: VoltxServer;
  private plugins: VoltxPlugin[] = [];
  private running = false;
  private shutdownCallbacks: Array<() => void | Promise<void>> = [];

  constructor(config?: Partial<VoltxConfig>) {
    this.config = defineConfig(config ?? {});
    this.logger = createLogger(this.config.name);
    this.plugins = this.config.plugins ?? [];

    // Create the HTTP server from config
    this.server = createServer({
      port: this.config.port,
      hostname: this.config.server?.hostname,
      routesDir: this.config.server?.routesDir ?? "api",
      staticDir: this.config.server?.staticDir ?? "public",
      cors: this.config.server?.cors ?? true,
      logger: this.config.server?.logger,
    });
  }

  /** Register a plugin */
  use(plugin: VoltxPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  /** Register a callback to run on shutdown */
  onShutdown(callback: () => void | Promise<void>): this {
    this.shutdownCallbacks.push(callback);
    return this;
  }

  /** Initialize all plugins and boot the app */
  async start(): Promise<void> {
    // Load env vars from .env files before anything else
    const { loadEnv } = await import("./env.js");
    loadEnv(process.env.NODE_ENV ?? "development");

    this.logger.info(`Starting ${this.config.name}...`);

    const ctx: VoltxContext = {
      config: this.config,
      logger: this.logger,
      server: this.server,
    };

    // Run plugins (they can add routes, middleware, etc. via ctx.server.app)
    for (const plugin of this.plugins) {
      this.logger.debug(`Loading plugin: ${plugin.name}`);
      await plugin.setup(ctx);
    }

    // Boot the HTTP server (scans routes, serves static files, starts listening)
    await this.server.start();
    this.running = true;

    // Graceful shutdown on process signals
    const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
    for (const signal of signals) {
      process.on(signal, () => {
        this.logger.info(`Received ${signal}, shutting down...`);
        this.stop().then(() => process.exit(0));
      });
    }
  }

  /** Gracefully stop the app and run shutdown callbacks */
  async stop(): Promise<void> {
    if (!this.running) return;
    this.logger.info(`Shutting down ${this.config.name}...`);

    await this.server.stop();

    for (const cb of this.shutdownCallbacks) {
      try {
        await cb();
      } catch (err) {
        this.logger.error("Shutdown callback error:", err);
      }
    }

    this.running = false;
    this.logger.info(`${this.config.name} stopped.`);
  }

  /** Check if the app is running */
  isRunning(): boolean {
    return this.running;
  }
}

/** Convenience factory */
export function createApp(config?: Partial<VoltxConfig>): VoltxApp {
  return new VoltxApp(config);
}

// ─── Re-exports from @voltx/server (convenience) ────────────────────────────

export { createServer } from "@voltx/server";
export type { VoltxServer, ServerConfig, ServerInfo, CorsConfig } from "@voltx/server";
export type { Context, RouteHandler, RouteModule } from "@voltx/server";

// ─── Version ─────────────────────────────────────────────────────────────────

export const VERSION = "0.4.2";
