import fs from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Port dédié aux e2e : le store mémoire est propre au process, on démarre
// toujours un serveur neuf (voir `webServer`) sans toucher à un `npm run dev`.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// Certains environnements d'exécution fournissent un Chromium pré-installé à
// cet emplacement fixe plutôt que celui que `npx playwright install` aurait
// téléchargé : on le réutilise s'il existe, sinon Playwright se comporte
// normalement (recherche du Chromium installé par Playwright).
const PREINSTALLED_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath = fs.existsSync(PREINSTALLED_CHROMIUM)
  ? PREINSTALLED_CHROMIUM
  : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  // Compilation à la demande de `next dev` : marge pour les premières requêtes.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  // `next dev` et non `next start` : l'authentification en mémoire
  // (DATA_PROVIDER=memory) est volontairement interdite en production, donc
  // en NODE_ENV=production. Aucune variable Supabase n'est nécessaire.
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATA_PROVIDER: "memory",
      MEMORY_AUTH_SECRET: "e2e-only-secret-not-for-production",
    },
  },
});
