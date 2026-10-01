import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getEnv, getPublicEnv } from "@/lib/env";

const ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("getPublicEnv", () => {
  it("applique la valeur par défaut de NEXT_PUBLIC_APP_URL quand elle est absente", () => {
    const env = getPublicEnv();
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("échoue avec un message clair en français quand l'URL est invalide", () => {
    process.env["NEXT_PUBLIC_APP_URL"] = "ceci-n-est-pas-une-url";
    expect(() => getPublicEnv()).toThrow(/NEXT_PUBLIC_APP_URL/);
    expect(() => getPublicEnv()).toThrow(/invalide/i);
  });

  it("n'expose jamais de variable serveur dans le résultat destiné au client", () => {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "secret-de-test";
    const env = getPublicEnv();
    expect(env).not.toHaveProperty("SUPABASE_SERVICE_ROLE_KEY");
    expect(JSON.stringify(env)).not.toContain("secret-de-test");
  });
});

describe("getEnv", () => {
  it("inclut les variables serveur en plus des variables publiques", () => {
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "secret-de-test";
    const env = getEnv();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe("secret-de-test");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });
});
