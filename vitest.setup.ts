import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

import "@testing-library/jest-dom/vitest";

// Le marqueur "server-only" lève par défaut hors du bundler Next.js (qui
// applique la condition d'export "react-server"). Vitest tourne en Node
// nu : on neutralise ce marqueur pour pouvoir tester le code serveur
// (src/lib/data, src/lib/supabase) sans reproduire ce contexte.
vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
});
