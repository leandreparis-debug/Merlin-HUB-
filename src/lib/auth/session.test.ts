import { beforeEach, describe, expect, it, vi } from "vitest";

import { VIEW_COOKIE_NAME } from "@/lib/auth/constants";
import { createRequestState, redirectTarget } from "@/lib/auth/test-helpers";
import { createMemoryRepositories } from "@/lib/data/providers/memory";

const request = createRequestState();
const state = vi.hoisted(() => ({
  userId: null as string | null,
  signOut: vi.fn(async () => undefined),
}));
let repos = createMemoryRepositories();

vi.mock("next/headers", () => ({
  cookies: () => request.nextHeaders.cookies(),
  headers: () => request.nextHeaders.headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => request.nextNavigation.redirect(url),
}));
vi.mock("@/lib/auth/factory", () => ({
  getAuthService: () => ({
    getAuthenticatedUserId: async () => state.userId,
    signOut: state.signOut,
  }),
}));
vi.mock("@/lib/data", () => ({
  getUserRepositories: async () => repos,
}));

const { getCurrentUser, requireAdmin, requireUser } =
  await import("@/lib/auth/session");

async function addProfile(input: {
  email: string;
  role?: "user" | "admin";
  mustChangePassword?: boolean;
  isActive?: boolean;
}) {
  const created = await repos.profiles.createForTests({
    id: crypto.randomUUID(),
    email: input.email,
    role: input.role ?? "user",
  });
  return repos.profiles.update(created.id, {
    mustChangePassword: input.mustChangePassword ?? false,
    isActive: input.isActive ?? true,
  });
}

beforeEach(() => {
  repos = createMemoryRepositories();
  state.userId = null;
  state.signOut.mockClear();
  request.cookies.clear();
  request.requestHeaders.clear();
  request.requestHeaders.set("x-merlin-path", "/admin?tab=1");
});

describe("getCurrentUser", () => {
  it("retourne null sans identité vérifiée", async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it("lit le rôle et mustChangePassword dans le profil", async () => {
    const profile = await addProfile({
      email: "a@example.test",
      role: "admin",
      mustChangePassword: true,
    });
    state.userId = profile.id;
    expect(await getCurrentUser()).toMatchObject({
      id: profile.id,
      role: "admin",
      mustChangePassword: true,
    });
  });

  it("refuse (et déconnecte) un profil inconnu ou désactivé", async () => {
    state.userId = crypto.randomUUID();
    expect(await getCurrentUser()).toBeNull();

    const inactive = await addProfile({
      email: "off@example.test",
      isActive: false,
    });
    state.userId = inactive.id;
    expect(await getCurrentUser()).toBeNull();
    expect(state.signOut).toHaveBeenCalledTimes(2);
  });
});

describe("requireUser", () => {
  it("redirige vers /login?next=… sans utilisateur", async () => {
    expect(await redirectTarget(() => requireUser())).toBe(
      "/login?next=%2Fadmin%3Ftab%3D1",
    );
  });

  it("neutralise un chemin courant dangereux", async () => {
    request.requestHeaders.set("x-merlin-path", "//evil.com");
    expect(await redirectTarget(() => requireUser())).toBe("/login?next=%2F");
  });

  it("redirige vers /change-password quand le changement est exigé", async () => {
    const profile = await addProfile({
      email: "n@example.test",
      mustChangePassword: true,
    });
    state.userId = profile.id;
    expect(await redirectTarget(() => requireUser())).toBe("/change-password");
  });

  it("laisse passer sur la page de changement (allowPasswordChange)", async () => {
    const profile = await addProfile({
      email: "n@example.test",
      mustChangePassword: true,
    });
    state.userId = profile.id;
    const user = await requireUser({ allowPasswordChange: true });
    expect(user.id).toBe(profile.id);
  });
});

describe("requireAdmin", () => {
  it("renvoie un utilisateur simple vers /, même avec un cookie de vue forgé", async () => {
    const profile = await addProfile({ email: "u@example.test" });
    state.userId = profile.id;
    request.cookies.set(VIEW_COOKIE_NAME, "admin");
    expect(await redirectTarget(() => requireAdmin())).toBe("/");
  });

  it("renvoie un admin en vue utilisateur vers /", async () => {
    const profile = await addProfile({
      email: "a@example.test",
      role: "admin",
    });
    state.userId = profile.id;
    request.cookies.set(VIEW_COOKIE_NAME, "user");
    expect(await redirectTarget(() => requireAdmin())).toBe("/");
  });

  it("laisse passer un admin en vue admin", async () => {
    const profile = await addProfile({
      email: "a@example.test",
      role: "admin",
    });
    state.userId = profile.id;
    expect((await requireAdmin()).role).toBe("admin");
  });

  it("redirige vers /login sans utilisateur", async () => {
    expect(await redirectTarget(() => requireAdmin())).toMatch(
      /^\/login\?next=/,
    );
  });
});
