import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Mirrored third-party LadiPage assets and raw scrape output are not our source.
    "public/assets/**",
    "scrape/**",
    // Local Netlify build output.
    ".netlify/**",
  ]),
]);

export default eslintConfig;
