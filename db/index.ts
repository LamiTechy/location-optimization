import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Schema = typeof schema;

/**
 * All application code is written against this type. The optional local
 * driver (PGlite) exposes the same Drizzle query API, so it is cast once here
 * instead of leaking a union type through every call site.
 */
export type Db = NeonHttpDatabase<Schema>;

/** `neon` (default) = serverless Postgres, `pglite` = embedded local Postgres. */
export type DbDriver = "neon" | "pglite";

function driver(): DbDriver {
  if (process.env.DB_DRIVER !== "pglite") return "neon";
  if (process.env.NODE_ENV === "production") {
    // Fails loudly instead of silently opening a throwaway embedded database
    // on a serverless host. Deliberately worded so it is logged as a plain
    // configuration error, not mistaken for a corrupt data directory.
    throw new Error(
      "The embedded database driver is for local development only. " +
        "Remove DB_DRIVER from this environment and set DATABASE_URL instead.",
    );
  }
  return "pglite";
}

function buildNeon(): Db {
  const url = env().DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return drizzleNeon({ client: neon(url), schema });
}

/**
 * Process-wide client cache.
 *
 * Next.js dev bundles each route handler (and the RSC layer) separately, so
 * this module is evaluated ~20 times in the same process. A module-level
 * `let` would therefore hand every route its own database handle, and PGlite
 * only supports one open handle per data directory: a second `new PGlite(dir)`
 * races the first one's WAL and kills it with `RuntimeError: Aborted()`.
 * Hanging the state off `globalThis` makes every copy share one handle.
 */
interface DbGlobals {
  __mapolyDb?: Promise<Db>;
  __mapolyDbClose?: () => Promise<void>;
}

const globals = globalThis as unknown as DbGlobals;

export const DB_RECOVERY_HINT =
  "Local database (.pglite-data) could not serve queries. It is usually damaged by an " +
  "interrupted or force-killed dev server - stop the server and run `npm run db:reset` " +
  "to rebuild it (migrate + seed + verify).";

/**
 * Lazily constructs the database client so that importing any module in this
 * project never requires a valid DATABASE_URL at build time.
 *
 * The PGlite branch is loaded dynamically: it is a dev-only driver used to run
 * the app without a cloud database, so production bundles never evaluate it.
 *
 * After opening the embedded database we probe it once. A damaged data
 * directory only fails on the first query, so without this probe the first
 * request after a bad shutdown would surface as a cryptic `RuntimeError:
 * Aborted()` instead of an actionable message. The probe also clears the
 * cached promise so the next request re-opens instead of reusing a dead
 * handle.
 */
export function getDb(): Promise<Db> {
  if (!globals.__mapolyDb) {
    const pending = (async (): Promise<Db> => {
      if (driver() !== "pglite") return buildNeon();
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");
      // pg_trgm gives the local database the same typo-tolerant search as Neon.
      const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
      const client = new PGlite(process.env.PGLITE_DATA_DIR ?? ".pglite-data", {
        extensions: { pg_trgm },
      });
      try {
        await client.query("select 1");
      } catch (cause) {
        // Release the half-open handle so the retry does not end up with two
        // PGlite instances fighting over the data directory.
        void client.close().catch(() => {});
        throw new Error(
          `${DB_RECOVERY_HINT} (${String((cause as Error)?.message ?? cause)})`,
        );
      }
      globals.__mapolyDbClose = () => client.close();
      return drizzle({ client, schema }) as unknown as Db;
    })();
    globals.__mapolyDb = pending;
    pending.catch(() => {
      if (globals.__mapolyDb === pending) globals.__mapolyDb = undefined;
    });
  }
  return globals.__mapolyDb;
}

/**
 * Forgets the cached client (tests and scripts that switch databases, and the
 * API layer when an embedded session aborts so the next request re-opens it).
 *
 * The stale handle is also closed: PGlite keeps its runtime alive after the
 * last query, and a lingering handle would fight the replacement for the data
 * directory. Closing an already-aborted handle can throw or reject, so it is
 * strictly best-effort and never blocks the caller.
 */
export function resetDb(): void {
  const close = globals.__mapolyDbClose;
  globals.__mapolyDb = undefined;
  globals.__mapolyDbClose = undefined;
  if (close) {
    try {
      void close().catch(() => {});
    } catch {
      /* the WASM runtime is already gone */
    }
  }
}

export { schema };
