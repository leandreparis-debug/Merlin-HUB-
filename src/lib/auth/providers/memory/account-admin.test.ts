import { beforeEach, describe, expect, it } from "vitest";

import type { AccountAdminService } from "@/lib/auth/account-admin";
import type { CookieStore } from "@/lib/auth/cookies";
import {
  createMemoryAuthService,
  type MemoryAuthService,
} from "@/lib/auth/providers/memory";
import { createMemoryAccountAdminService } from "@/lib/auth/providers/memory/account-admin";
import { createMemoryRepositories } from "@/lib/data/providers/memory";

function noCookies(): CookieStore {
  const values = new Map<string, string>();
  return {
    async get(name) {
      return values.get(name);
    },
    async set(name, value) {
      values.set(name, value);
    },
    async delete(name) {
      values.delete(name);
    },
  };
}

let repos: ReturnType<typeof createMemoryRepositories>;
let auth: MemoryAuthService;
let service: AccountAdminService;

beforeEach(() => {
  repos = createMemoryRepositories();
  auth = createMemoryAuthService({
    profiles: repos.profiles,
    cookies: noCookies(),
    secret: "test-secret-at-least-16-chars",
  });
  service = createMemoryAccountAdminService({ auth, profiles: repos.profiles });
});

describe("AccountAdminService (mémoire)", () => {
  it("crée le compte et le profil avec le rôle demandé et mustChangePassword = true", async () => {
    const result = await service.createAccount({
      email: "Nouveau.Collegue@example.test",
      fullName: "Nouvelle Collègue",
      role: "admin",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provisionalPassword).toHaveLength(20);

    const profile = await repos.profiles.getById(result.userId);
    expect(profile).toMatchObject({
      email: "nouveau.collegue@example.test",
      fullName: "Nouvelle Collègue",
      role: "admin",
      mustChangePassword: true,
      isActive: true,
    });
  });

  it("le mot de passe provisoire permet de se connecter", async () => {
    const created = await service.createAccount({
      email: "login@example.test",
      fullName: null,
      role: "user",
    });
    if (!created.ok) throw new Error("création attendue");

    const signIn = await auth.signInWithPassword(
      "login@example.test",
      created.provisionalPassword,
    );
    expect(signIn).toMatchObject({
      ok: true,
      user: { role: "user", mustChangePassword: true },
    });
    expect(
      (await auth.signInWithPassword("login@example.test", "faux")).ok,
    ).toBe(false);
  });

  it("refuse un email en doublon avec email_exists (casse ignorée)", async () => {
    await service.createAccount({
      email: "double@example.test",
      fullName: null,
      role: "user",
    });
    const second = await service.createAccount({
      email: "DOUBLE@example.test",
      fullName: null,
      role: "admin",
    });
    expect(second).toEqual({ ok: false, reason: "email_exists" });
    expect(await repos.profiles.list({ includeInactive: true })).toHaveLength(
      1,
    );
  });

  it("réinitialise : l'ancien mot de passe cesse de fonctionner, le nouveau oui, mustChangePassword repasse à vrai", async () => {
    const created = await service.createAccount({
      email: "reset@example.test",
      fullName: null,
      role: "user",
    });
    if (!created.ok) throw new Error("création attendue");
    await repos.profiles.update(created.userId, { mustChangePassword: false });

    const reset = await service.resetPassword(created.userId);
    expect(reset.ok).toBe(true);
    if (!reset.ok) return;
    expect(reset.provisionalPassword).not.toBe(created.provisionalPassword);

    expect(
      (
        await auth.signInWithPassword(
          "reset@example.test",
          created.provisionalPassword,
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await auth.signInWithPassword(
          "reset@example.test",
          reset.provisionalPassword,
        )
      ).ok,
    ).toBe(true);
    expect(
      (await repos.profiles.getById(created.userId)).mustChangePassword,
    ).toBe(true);
  });

  it("retourne not_found pour un utilisateur inconnu", async () => {
    expect(
      await service.resetPassword("00000000-0000-4000-8000-0000000000ff"),
    ).toEqual({ ok: false, reason: "not_found" });
  });

  it("revokeSessions ne lève jamais et indique qu'aucune session n'est révoquée", async () => {
    expect(await service.revokeSessions("n'importe quoi")).toBe(false);
  });
});
