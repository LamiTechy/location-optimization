/**
 * Applies the SQL files in `db/migrations/` in order.
 *
 * Uses Drizzle's programmatic migrator so it works with both drivers:
 *   DB_DRIVER=neon    (default)  -> serverless Postgres via `npm run db:migrate`
 *   DB_DRIVER=pglite             -> embedded local Postgres
 *
 * Migration files themselves are produced by `npm run db:generate`.
 */
import path from "node:path";
import { getDb } from "./index";
import { loadEnvFiles } from "@/lib/load-env";

loadEnvFiles();

async function main() {
  const driver = process.env.DB_DRIVER === "pglite" ? "pglite" : "neon";
  const db = await getDb();
  const migrationsFolder = path.join(process.cwd(), "db", "migrations");

  if (driver === "pglite") {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as never, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(db, { migrationsFolder });
  }

  console.log(`Migrations applied (driver: ${driver}).`);
}

main().catch((error) => {
  console.error("\nMigration failed:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
