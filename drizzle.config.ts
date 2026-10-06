import { loadEnvFiles } from "./lib/load-env";
import { defineConfig } from "drizzle-kit";

loadEnvFiles();

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  strict: true,
  verbose: true,
  dbCredentials: {
    // Tolerated by `generate`; `migrate` fails with a clear message when the
    // variable is missing.
    url: process.env.DATABASE_URL ?? "",
  },
});
