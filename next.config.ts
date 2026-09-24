import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WASM/data files from its own package directory at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
