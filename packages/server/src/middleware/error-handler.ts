// @voltx/server — Error handler middleware

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Default error handler for VoltX server.
 * Returns JSON error responses with appropriate status codes.
 */
export function createErrorHandler(
  customHandler?: (err: Error, c: Context) => Response | Promise<Response>,
) {
  return async (err: Error, c: Context): Promise<Response> => {
    // Let custom handler take over if provided
    if (customHandler) {
      try {
        return await customHandler(err, c);
      } catch {
        // If custom handler throws, fall through to default
      }
    }

    const status = extractStatus(err);
    const isDev = process.env.NODE_ENV !== "production";

    console.error(`[voltx] Error ${status}:`, err.message);
    if (isDev && err.stack) {
      console.error(err.stack);
    }

    return c.json(
      {
        error: {
          message: isDev ? err.message : "Internal Server Error",
          status,
          ...(isDev && err.stack ? { stack: err.stack } : {}),
        },
      },
      status as ContentfulStatusCode,
    );
  };
}

/** Extract HTTP status from error if available */
function extractStatus(err: unknown): number {
  if (err && typeof err === "object") {
    if ("status" in err && typeof (err as Record<string, unknown>).status === "number") {
      return (err as Record<string, unknown>).status as number;
    }
    if ("statusCode" in err && typeof (err as Record<string, unknown>).statusCode === "number") {
      return (err as Record<string, unknown>).statusCode as number;
    }
  }
  return 500;
}
