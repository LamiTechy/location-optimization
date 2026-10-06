import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Optional local Postgres driver (PGlite) and its platform bits are loaded
   * at runtime, never bundled - production always uses the Neon driver.
   */
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingExcludes: {
    "*": ["**/.pglite-data/**", "**/node_modules/.cache/**"],
  },
};

export default nextConfig;
