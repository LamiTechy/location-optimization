import { DB_RECOVERY_HINT, resetDb } from "@/db";
import { jsonError } from "./response";

/**
 * Flattens an error and its `cause` chain into one string.
 *
 * Drizzle wraps the driver failure in a `DrizzleQueryError` whose message is
 * only `Failed query: <sql>` - the interesting part (`RuntimeError: Aborted()`)
 * lives on `error.cause`, which `String(error)` never reaches.
 */
function describeError(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current !== null && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const { message, cause } = current as { message?: unknown; cause?: unknown };
    parts.push(typeof message === "string" ? message : String(current));
    current = cause;
  }
  return parts.join("\n");
}

const DB_FAILURE = /Aborted\(\)|PGlite|\.pglite-data/i;

/**
 * Route handler wrapper that converts unexpected exceptions into the standard
 * error envelope without ever leaking a stack trace to the client.
 */
export async function handleRoute(
  fn: () => Promise<Response>,
): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    // The embedded (PGlite) driver dies with `RuntimeError: Aborted()` when its
    // data directory was damaged or opened twice. Drop the dead handle so the
    // next request re-opens it (and reports the recovery hint if it is still
    // broken).
    if (DB_FAILURE.test(describeError(error))) {
      resetDb();
      console.error(`[db] ${DB_RECOVERY_HINT}`);
      console.error("[api] database error:", error);
      // Dev instructions are only useful (and true) for the local driver in
      // development - a deployed user must never be told to restart a dev
      // server they do not have.
      const localDevDb =
        process.env.NODE_ENV !== "production" && process.env.DB_DRIVER === "pglite";
      return jsonError(
        503,
        "DB_UNAVAILABLE",
        localDevDb
          ? "The local database stopped responding. Restart the dev server " +
            "(run `npm run db:reset` first if the error persists), then try again."
          : "The database is unavailable. Please try again shortly.",
      );
    }
    console.error("[api] unhandled error:", error);
    return jsonError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
