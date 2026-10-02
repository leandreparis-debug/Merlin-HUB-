import { beforeEach, describe, expect, it, vi } from "vitest";

import { VIEW_COOKIE_NAME } from "@/lib/auth/constants";
import { createRequestState, redirectTarget } from "@/lib/auth/test-helpers";

process.env["DATA_PROVIDER"] = "memory";

const request = createRequestState();
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: () => request.nextHeaders.cookies(),
  headers: () => request.nextHeaders.headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => request.nextNavigation.redirect(url),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

const actions = await import("@/lib/auth/actions");
const { getMemoryRepositories } = await import("@/lib/data");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function login(email: string, password: string, next = "/") {
  return actions.loginAction({}, form({ email, password, next }));
}

async function logs(action?: string) {
  const entries = await getMemoryRepositories().activityLog.list({
    limit: 100,
  });
  return action ? entries.filter((entry) => entry.action === action) : entries;
}

beforeEach(() => {
  request.cookies.clear();
  request.requestHeaders.clear();
  request.requestHeaders.set("x-merlin-path", "/");
  revalidatePath.mockClear();
});

describe("loginAction", () => {
  it("connecte, met à jour lastLoginAt, journalise et redirige vers next", async () => {
    const target = await redirectTarget(() =>
      login("USER@example.test", "User-Password-123", "/admin"),
    );
    expect(target).toBe("/admin");

    const profile =
      await getMemoryRepositories().profiles.getByEmail("user@example.test");
    expect(profile.lastLoginAt).not.toBeNull();
    const entries = await logs("auth.login");
    expect(entries.at(0)).toMatchObject({
      actorId: profile.id,
      actorEmail: "user@example.test",
    });
  });

  it("ignore un next malveillant", async () => {
    expect(
      await redirectTarget(() =>
        login("user@example.test", "User-Password-123", "//evil.com"),
      ),
    ).toBe("/");
  });

  it("redirige vers /change-password si le mot de passe doit être changé", async () => {
    expect(
      await redirectTarget(() =>
        login("nouveau@example.test", "Temp-Password-1234", "/admin"),
      ),
    ).toBe("/change-password");
  });

  it("renvoie un message générique pour un mauvais mot de passe et un email inconnu, et journalise sans mot de passe", async () => {
    const wrong = await login("user@example.test", "mauvais");
    const unknown = await login("inconnu@example.test", "mauvais");
    expect(wrong.error).toBe("Email ou mot de passe incorrect");
    expect(unknown.error).toBe(wrong.error);

    const failed = await logs("auth.login_failed");
    expect(failed.length).toBeGreaterThanOrEqual(2);
    expect(failed[0]?.metadata).toEqual({
      email: "inconnu@example.test",
      reason: "invalid_credentials",
    });
    expect(JSON.stringify(failed)).not.toContain("mauvais");
  });

  it("annonce un compte désactivé après un mot de passe correct", async () => {
    const result = await login("desactive@example.test", "Disabled-Pass-123");
    expect(result.error).toBe(
      "Ce compte est désactivé. Contactez l'administrateur.",
    );
  });

  it("refuse une saisie invalide sans appeler le fournisseur", async () => {
    const result = await login("pas-un-email", "x");
    expect(result.error).toMatch(/email valide/);
  });

  it("impose un délai minimal sur échec", async () => {
    const started = Date.now();
    await login("user@example.test", "mauvais");
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
  });
});

describe("changePasswordAction", () => {
  it("redirige vers /login sans session", async () => {
    expect(
      await redirectTarget(() =>
        actions.changePasswordAction({}, form({ currentPassword: "x" })),
      ),
    ).toMatch(/^\/login/);
  });

  it("refuse selon la politique, la confirmation et le mot de passe actuel, puis réussit", async () => {
    await redirectTarget(() =>
      login("nouveau@example.test", "Temp-Password-1234"),
    );
    const change = (fields: Record<string, string>) =>
      actions.changePasswordAction({}, form(fields));

    expect(
      (
        await change({
          currentPassword: "Temp-Password-1234",
          newPassword: "court",
          confirmPassword: "court",
        })
      ).error,
    ).toMatch(/au moins 12/);
    expect(
      (
        await change({
          currentPassword: "Temp-Password-1234",
          newPassword: "Un-Mot-De-Passe-Solide-1",
          confirmPassword: "Autre-Chose-Solide-12",
        })
      ).error,
    ).toMatch(/confirmation/);
    expect(
      (
        await change({
          currentPassword: "faux",
          newPassword: "Un-Mot-De-Passe-Solide-1",
          confirmPassword: "Un-Mot-De-Passe-Solide-1",
        })
      ).error,
    ).toBe("Le mot de passe actuel est incorrect.");

    const profileBefore = await getMemoryRepositories().profiles.getByEmail(
      "nouveau@example.test",
    );
    expect(profileBefore.mustChangePassword).toBe(true);

    const target = await redirectTarget(() =>
      change({
        currentPassword: "Temp-Password-1234",
        newPassword: "Un-Mot-De-Passe-Solide-1",
        confirmPassword: "Un-Mot-De-Passe-Solide-1",
      }),
    );
    expect(target).toBe("/?notice=password-changed");

    const profileAfter = await getMemoryRepositories().profiles.getByEmail(
      "nouveau@example.test",
    );
    expect(profileAfter.mustChangePassword).toBe(false);
    expect(await logs("auth.password_changed")).toHaveLength(1);
  });
});

describe("toggleViewModeAction", () => {
  it("est ignorée pour un utilisateur simple", async () => {
    await redirectTarget(() => login("user@example.test", "User-Password-123"));
    await actions.toggleViewModeAction();
    expect(request.cookies.has(VIEW_COOKIE_NAME)).toBe(false);
    expect(await logs("auth.view_mode_changed")).toHaveLength(0);
  });

  it("bascule un admin entre les deux vues, journalise et revalide", async () => {
    await redirectTarget(() =>
      login("admin@example.test", "Admin-Password-123"),
    );

    await actions.toggleViewModeAction();
    expect(request.cookies.get(VIEW_COOKIE_NAME)).toBe("user");
    expect(revalidatePath).toHaveBeenCalled();

    await actions.toggleViewModeAction();
    expect(request.cookies.get(VIEW_COOKIE_NAME)).toBe("admin");

    const entries = await logs("auth.view_mode_changed");
    expect(entries.map((entry) => entry.metadata)).toEqual(
      expect.arrayContaining([{ view: "user" }, { view: "admin" }]),
    );
  });

  it("redirige vers / quand on quitte la vue admin depuis /admin", async () => {
    await redirectTarget(() =>
      login("admin@example.test", "Admin-Password-123"),
    );
    request.requestHeaders.set("x-merlin-path", "/admin");
    expect(await redirectTarget(() => actions.toggleViewModeAction())).toBe(
      "/",
    );
  });
});

describe("logoutAction", () => {
  it("journalise, ferme la session et redirige vers /login", async () => {
    await redirectTarget(() => login("user@example.test", "User-Password-123"));
    expect(await redirectTarget(() => actions.logoutAction())).toBe("/login");
    expect(await logs("auth.logout")).toHaveLength(1);

    expect(
      await redirectTarget(() =>
        actions.changePasswordAction({}, form({ currentPassword: "x" })),
      ),
    ).toMatch(/^\/login/);
  });
});
