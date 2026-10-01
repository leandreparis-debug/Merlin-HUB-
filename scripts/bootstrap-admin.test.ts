import { describe, expect, it } from "vitest";

import {
  bootstrapAdmin,
  generatePassword,
  parseArgs,
  type BootstrapAdminDeps,
} from "./bootstrap-admin";

describe("parseArgs", () => {
  it("exige --email", () => {
    expect(() => parseArgs([])).toThrow(/--email/);
  });

  it("rejette un email invalide", () => {
    expect(() => parseArgs(["--email", "pas-un-email"])).toThrow(/invalide/);
  });

  it("normalise l'email en minuscules et lit --name et --force", () => {
    const args = parseArgs([
      "--email",
      "ADMIN@Example.com",
      "--name",
      "Prénom Nom",
      "--force",
    ]);

    expect(args).toEqual({
      email: "admin@example.com",
      name: "Prénom Nom",
      force: true,
    });
  });

  it("accepte la syntaxe --email=valeur", () => {
    const args = parseArgs(["--email=admin@example.com"]);
    expect(args.email).toBe("admin@example.com");
    expect(args.force).toBe(false);
  });
});

describe("generatePassword", () => {
  it("génère un mot de passe de 20 caractères par défaut", () => {
    expect(generatePassword()).toHaveLength(20);
  });

  it("respecte une longueur personnalisée", () => {
    expect(generatePassword(32)).toHaveLength(32);
  });

  it("génère des mots de passe différents à chaque appel (aléa)", () => {
    const passwords = new Set(
      Array.from({ length: 20 }, () => generatePassword()),
    );
    expect(passwords.size).toBe(20);
  });
});

describe("bootstrapAdmin", () => {
  function fakeDeps(
    overrides: Partial<BootstrapAdminDeps> = {},
  ): BootstrapAdminDeps {
    return {
      countActiveAdmins: async () => 0,
      createAuthUser: async () => ({
        id: "11111111-2222-4333-8444-555555555555",
      }),
      promoteToAdmin: async () => {},
      ...overrides,
    };
  }

  it("crée l'administrateur quand aucun admin actif n'existe", async () => {
    const deps = fakeDeps();
    const result = await bootstrapAdmin(
      { email: "admin@example.com", force: false },
      deps,
    );

    expect(result.email).toBe("admin@example.com");
    expect(result.password).toHaveLength(20);
    expect(result.userId).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("refuse de s'exécuter si un admin actif existe déjà", async () => {
    const deps = fakeDeps({ countActiveAdmins: async () => 1 });

    await expect(
      bootstrapAdmin({ email: "admin@example.com", force: false }, deps),
    ).rejects.toThrow(/administrateur actif existe déjà/);
  });

  it("--force permet de créer un admin même si un admin actif existe déjà", async () => {
    const deps = fakeDeps({ countActiveAdmins: async () => 1 });

    const result = await bootstrapAdmin(
      { email: "admin@example.com", force: true },
      deps,
    );
    expect(result.email).toBe("admin@example.com");
  });

  it("promeut l'utilisateur créé en administrateur", async () => {
    let promotedId: string | undefined;
    const deps = fakeDeps({
      promoteToAdmin: async (userId) => {
        promotedId = userId;
      },
    });

    const result = await bootstrapAdmin(
      { email: "admin@example.com", force: false },
      deps,
    );
    expect(promotedId).toBe(result.userId);
  });
});
