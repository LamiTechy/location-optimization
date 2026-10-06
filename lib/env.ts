import { z } from "zod";

/**
 * Environment validation.
 *
 * Parsed lazily so that importing this module never throws during `next build`
 * page-data collection. Call `env()` from server code only (route handlers,
 * middleware, db client, scripts). Client code must use `NEXT_PUBLIC_*` values
 * directly through `process.env` (Next.js inlines them at build time).
 */
const serverSchema = z
  .object({
    // Required unless DB_DRIVER=pglite (embedded local Postgres needs no URL).
    DATABASE_URL: z
      .string()
      .refine(
        (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
        "DATABASE_URL must be a postgres:// connection string",
      )
      .optional(),
    JWT_SECRET: z
      .string()
      .min(16, "JWT_SECRET must be at least 16 characters")
      .refine(
        (v) => process.env.NODE_ENV !== "production" || v.length >= 32,
        "JWT_SECRET must be at least 32 characters in production",
      ),
    // Used by `npm run db:seed` to create the admin account (optional otherwise).
    ADMIN_EMAIL: z
      .string()
      .refine((v) => v === "" || /.+@.+\..+/.test(v), "ADMIN_EMAIL must be a valid email")
      .optional(),
    ADMIN_PASSWORD: z
      .string()
      .refine(
        (v) => v === "" || v.length >= 8,
        "ADMIN_PASSWORD must be at least 8 characters",
      )
      .optional(),
    NEXT_PUBLIC_APP_URL: z
      .string()
      .refine(
        (v) => /^https?:\/\//.test(v),
        "NEXT_PUBLIC_APP_URL must be a valid URL",
      )
      .default("http://localhost:3000"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  })
  .superRefine((data, ctx) => {
    if (process.env.DB_DRIVER === "pglite") return;
    if (!data.DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message:
          "DATABASE_URL is required (or set DB_DRIVER=pglite for local embedded Postgres)",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

/** Validates and returns the server-side environment variables. */
export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  - ");
    throw new Error(`Invalid environment variables:\n  - ${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Public (client-safe) application URL. */
export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
