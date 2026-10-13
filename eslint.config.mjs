import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// maps-links, export and matching must stay pure (no IO) and may only depend
// on lib/db (types) and lib/matching.
const IO_IMPORTS = [
  "@/lib/db/client",
  "@/lib/auth",
  "@/lib/auth/*",
  "@/lib/geocoding",
  "@/lib/geocoding/*",
  "@/lib/i18n/server",
  "@/app/*",
  "@/components/*",
  "next",
  "next/*",
  "react",
  "react-dom",
  "postgres",
  "server-only",
  "fs",
  "node:*",
];

function pureModule(files, forbiddenSiblings) {
  return {
    files,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [...IO_IMPORTS, ...forbiddenSiblings],
              message:
                "This module must be pure: no IO, and only lib/db types and lib/matching.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "This module must be pure (no IO)." },
      ],
    },
  };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  pureModule(["src/lib/maps-links/**"], ["@/lib/export", "@/lib/export/*"]),
  pureModule(["src/lib/export/**"], ["@/lib/maps-links", "@/lib/maps-links/*"]),
  pureModule(
    ["src/lib/matching/**"],
    [
      "@/lib/export",
      "@/lib/export/*",
      "@/lib/maps-links",
      "@/lib/maps-links/*",
    ],
  ),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Playwright fixtures receive a `use` callback that is not a React hook.
    files: ["tests/e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    "artifacts/**",
    ".pgdata/**",
  ]),
]);

export default eslintConfig;
