import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript", "prettier"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    // Un paramètre ou une variable préfixé "_" est intentionnellement
    // inutilisé (ex. un paramètre d'interface non exploité par un stub).
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Aucun accès direct à Supabase en dehors de la couche de données :
    // voir docs/ARCHITECTURE.md § Couche d'abstraction données et
    // authentification. Dérogation ci-dessous pour src/lib/data,
    // src/lib/supabase, scripts/ et les tests.
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "@supabase/**"],
              message:
                "Import direct de @supabase/* interdit en dehors de src/lib/data et src/lib/supabase. Passez par les repositories exposés par src/lib/data (voir docs/ARCHITECTURE.md).",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/lib/data/**/*.{ts,tsx}",
      "src/lib/supabase/**/*.{ts,tsx}",
      "src/lib/auth/**/*.{ts,tsx}",
      "scripts/**/*.{ts,tsx}",
      "**/*.test.{ts,tsx}",
      "supabase/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
