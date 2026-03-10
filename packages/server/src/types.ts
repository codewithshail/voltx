// @voltx/server — Core types

import type { Hono, Context } from "hono";

// ─── Server Config ───────────────────────────────────────────────────────────

export interface ServerConfig {
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Hostname to bind to (default: "0.0.0.0") */
  hostname?: string;
  /** Directory to scan for file-based routes (default: "api") */
  routesDir?: string;
  /** Directory for static files (default: "public") */
  staticDir?: string;
  /** Enable CORS (default: true in dev) */
  cors?: boolean | CorsConfig;
  /** Enable request logging (default: true in dev) */
  logger?: boolean;
  /** Custom error handler */
  onError?: (err: Error, c: Context) => Response | Promise<Response>;
  /** Called when server starts */
  onStart?: (info: ServerInfo) => void;
}

export interface CorsConfig {
  /** Allowed origins (default: "*") */
  origin?: string | string[];
  /** Allowed HTTP methods */
  allowMethods?: string[];
  /** Allowed headers */
  allowHeaders?: string[];
  /** Exposed headers */
  exposeHeaders?: string[];
  /** Max age for preflight cache (seconds) */
  maxAge?: number;
  /** Allow credentials */
  credentials?: boolean;
}

export interface ServerInfo {
  port: number;
  hostname: string;
  url: string;
}

// ─── Route Types ─────────────────────────────────────────────────────────────

/** HTTP methods that route files can export */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

/** A route handler function — receives Hono Context, returns Response */
export type RouteHandler = (c: Context) => Response | Promise<Response>;

/** What a route file can export */
export interface RouteModule {
  GET?: RouteHandler;
  POST?: RouteHandler;
  PUT?: RouteHandler;
  DELETE?: RouteHandler;
  PATCH?: RouteHandler;
  HEAD?: RouteHandler;
  OPTIONS?: RouteHandler;
  /** Middleware that runs before all handlers in this route */
  middleware?: MiddlewareHandler | MiddlewareHandler[];
}

/** Middleware handler (Hono-style) */
export type MiddlewareHandler = (c: Context, next: () => Promise<void>) => Promise<void | Response>;

/** A registered route entry */
export interface RouteEntry {
  /** HTTP method */
  method: HttpMethod;
  /** URL path pattern (e.g., "/api/users/:id") */
  path: string;
  /** Handler function */
  handler: RouteHandler;
  /** Source file path (for debugging) */
  filePath: string;
}

// ─── VoltxServer ─────────────────────────────────────────────────────────────

export interface VoltxServer {
  /** The underlying Hono app instance */
  app: Hono;
  /** Start listening for requests */
  start(): Promise<ServerInfo>;
  /** Stop the server */
  stop(): Promise<void>;
  /** Register routes from a directory (file-based routing) */
  registerRoutes(routesDir: string): Promise<RouteEntry[]>;
  /** Get all registered routes */
  routes(): RouteEntry[];
}
