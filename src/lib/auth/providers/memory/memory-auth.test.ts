import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CookieStore } from "@/lib/auth/cookies";
import { MEMORY_SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import {
  createMemoryAuthService,
  type MemoryAuthService,
} from "@/lib/auth/providers/memory";
import {
  signSessionCookie,
  verifySessionCookie,
} from "@/lib/auth/providers/memory/session-cookie";
import { createMemoryRepositories } from "@/lib/data/providers/memory";

const SECRET = "test-secret-at-least-16-chars";

function createCookieJar(): CookieStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
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

let jar: ReturnType<typeof createCookieJar>;
let service: MemoryAuthService;
let clock: number;
let repos: ReturnType<typeof createMemoryRepositories>;

beforeEach(async () => {
  jar = createCookieJar();
  clock = 1_700_000_000_000;
  repos = createMemoryRepositories();
  service = createMemoryAuthService({
    profiles: repos.profiles,
    cookies: jar,
    secret: SECRET,
    now: () => clock,
  });
  await service.addAccount({
    email: "user@example.test",
    password: "User-Password-123",
    fullName: "Camille",
  });
  await service.addAccount({
    email: "off@example.test",
    password: "Disabled-Pass-123",
    isActive: false,
  });
});

describe("authentification mémoire", () => {
  it("connecte avec les bons identifiants (email insensible à la casse) et ouvre une session", async () => {
    const result = await service.signInWithPassword(
      "User@Example.test",
      "User-Password-123",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user).toMatchObject({
        email: "user@example.test",
        role: "user",
        mustChangePassword: false,
      });
      expect(await service.getAuthenticatedUserId()).toBe(result.user.id);
    }
    expect(jar.values.has(MEMORY_SESSION_COOKIE_NAME)).toBe(true);
  });

  it("refuse un mauvais mot de passe et un email inconnu avec la même raison", async () => {
    const wrongPassword = await service.signInWithPassword(
      "user@example.test",
      "mauvais",
    );
    const unknownEmail = await service.signInWithPassword(
      "inconnu@example.test",
      "User-Password-123",
    );
    expect(wrongPassword).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(unknownEmail).toEqual(wrongPassword);
    expect(jar.values.size).toBe(0);
  });

  it("annonce « disabled » uniquement après un mot de passe correct, sans ouvrir de session", async () => {
    expect(
      await service.signInWithPassword("off@example.test", "Disabled-Pass-123"),
    ).toEqual({ ok: false, reason: "disabled" });
    expect(
      await service.signInWithPassword("off@example.test", "mauvais"),
    ).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(jar.values.size).toBe(0);
  });

  it("rejette un cookie falsifié", async () => {
    await service.signInWithPassword("user@example.test", "User-Password-123");
    const value = jar.values.get(MEMORY_SESSION_COOKIE_NAME) ?? "";
    const [body, signature] = value.split(".") as [string, string];

    jar.values.set(
      MEMORY_SESSION_COOKIE_NAME,
      `${body}.${"A".repeat(signature.length)}`,
    );
    expect(await service.getAuthenticatedUserId()).toBeNull();

    const forgedPayload = btoa(
      JSON.stringify({ uid: "autre", exp: clock + 1e9 }),
    );
    jar.values.set(MEMORY_SESSION_COOKIE_NAME, `${forgedPayload}.${signature}`);
    expect(await service.getAuthenticatedUserId()).toBeNull();

    jar.values.set(MEMORY_SESSION_COOKIE_NAME, "n'importe quoi");
    expect(await service.getAuthenticatedUserId()).toBeNull();
  });

  it("rejette un cookie signé avec un autre secret", async () => {
    const value = await signSessionCookie(
      { uid: "u", exp: clock + 1e9 },
      "un-autre-secret-assez-long",
    );
    jar.values.set(MEMORY_SESSION_COOKIE_NAME, value);
    expect(await service.getAuthenticatedUserId()).toBeNull();
  });

  it("rejette un cookie expiré", async () => {
    await service.signInWithPassword("user@example.test", "User-Password-123");
    clock += 9 * 60 * 60 * 1000;
    expect(await service.getAuthenticatedUserId()).toBeNull();
  });

  it("déconnecte en supprimant le cookie", async () => {
    await service.signInWithPassword("user@example.test", "User-Password-123");
    await service.signOut();
    expect(await service.getAuthenticatedUserId()).toBeNull();
  });

  it("change le mot de passe : refuse un mauvais mot de passe actuel, puis accepte le bon", async () => {
    const profile = await repos.profiles.getByEmail("user@example.test");

    expect(
      await service.updatePassword(
        profile.id,
        "mauvais",
        "Nouveau-Mot-De-Passe-9",
      ),
    ).toEqual({ ok: false, reason: "wrong_current_password" });
    expect(
      (
        await service.signInWithPassword(
          "user@example.test",
          "User-Password-123",
        )
      ).ok,
    ).toBe(true);

    expect(
      await service.updatePassword(
        profile.id,
        "User-Password-123",
        "Nouveau-Mot-De-Passe-9",
      ),
    ).toEqual({ ok: true });
    expect(
      (
        await service.signInWithPassword(
          "user@example.test",
          "User-Password-123",
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await service.signInWithPassword(
          "user@example.test",
          "Nouveau-Mot-De-Passe-9",
        )
      ).ok,
    ).toBe(true);
  });
});

describe("cookie de session signé", () => {
  it("fait l'aller-retour signature/vérification", async () => {
    const value = await signSessionCookie({ uid: "abc", exp: 2000 }, SECRET);
    expect(await verifySessionCookie(value, SECRET, 1000)).toEqual({
      uid: "abc",
      exp: 2000,
    });
    expect(await verifySessionCookie(value, SECRET, 3000)).toBeNull();
    expect(await verifySessionCookie(undefined, SECRET)).toBeNull();
  });
});

describe("garde de production", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("refuse d'activer l'authentification mémoire en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATA_PROVIDER", "memory");
    const { getAuthService } = await import("@/lib/auth/factory");
    expect(() => getAuthService()).toThrow(/production/);
    vi.unstubAllEnvs();
  });
});
