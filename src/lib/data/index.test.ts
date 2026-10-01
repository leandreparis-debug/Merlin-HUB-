import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "DATA_PROVIDER",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  for (const key of ENV_KEYS) delete process.env[key];
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("fabrique de repositories (DATA_PROVIDER=memory)", () => {
  it("getAdminRepositories retourne le store mémoire", async () => {
    process.env["DATA_PROVIDER"] = "memory";
    const { getAdminRepositories } = await import("@/lib/data");

    const repos = getAdminRepositories();
    const app = await repos.apps.create({ slug: "test-app", name: "Test" });
    expect(app.slug).toBe("test-app");
  });

  it("getUserRepositories et getAdminRepositories partagent le même store (singleton de process)", async () => {
    process.env["DATA_PROVIDER"] = "memory";
    const { getAdminRepositories, getUserRepositories } =
      await import("@/lib/data");

    const admin = getAdminRepositories();
    const created = await admin.apps.create({
      slug: "partage",
      name: "Partagé",
    });

    const user = await getUserRepositories();
    const found = await user.apps.getById(created.id);
    expect(found.slug).toBe("partage");
  });

  it("lève une erreur explicite si DATA_PROVIDER=memory en production", async () => {
    process.env["DATA_PROVIDER"] = "memory";
    vi.stubEnv("NODE_ENV", "production");

    const { getAdminRepositories } = await import("@/lib/data");
    expect(() => getAdminRepositories()).toThrow(/production/);
  });
});

describe("getServerEnv (variables Supabase manquantes)", () => {
  it("liste précisément les variables Supabase manquantes sans afficher de valeurs", async () => {
    const { getServerEnv } = await import("@/lib/env");

    let thrown: unknown;
    try {
      getServerEnv();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(message).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(message).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("ne lève pas quand DATA_PROVIDER=memory, même sans variables Supabase", async () => {
    process.env["DATA_PROVIDER"] = "memory";
    const { getServerEnv } = await import("@/lib/env");
    expect(() => getServerEnv()).not.toThrow();
  });
});
