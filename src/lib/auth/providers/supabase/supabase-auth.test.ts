import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createSupabaseAuthService } from "@/lib/auth/providers/supabase";
import type { Profile } from "@/lib/data/types";

const profile: Profile = {
  id: "user-1",
  email: "user@example.test",
  fullName: "Camille",
  role: "user",
  mustChangePassword: false,
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function setup(options: {
  signIn?: { data: { user: { id: string } | null }; error: unknown };
  getUser?: {
    data: { user: { id: string; email?: string } | null };
    error: unknown;
  };
  updateUser?: { error: unknown };
  profile?: Profile | null;
}) {
  const auth = {
    signInWithPassword: vi.fn(
      async () =>
        options.signIn ?? { data: { user: { id: "user-1" } }, error: null },
    ),
    signOut: vi.fn(async () => ({ error: null })),
    getUser: vi.fn(
      async () =>
        options.getUser ?? {
          data: { user: { id: "user-1", email: "user@example.test" } },
          error: null,
        },
    ),
    updateUser: vi.fn(async () => options.updateUser ?? { error: null }),
  };
  const service = createSupabaseAuthService({
    createClient: async () => ({ auth }) as unknown as SupabaseClient,
    loadProfile: async () =>
      options.profile === undefined ? profile : options.profile,
  });
  return { auth, service };
}

describe("createSupabaseAuthService", () => {
  it("connecte un profil actif", async () => {
    const { service } = setup({});
    const result = await service.signInWithPassword("user@example.test", "x");
    expect(result).toMatchObject({
      ok: true,
      user: { id: "user-1", role: "user" },
    });
  });

  it("traduit les identifiants invalides", async () => {
    const { service } = setup({
      signIn: {
        data: { user: null },
        error: { code: "invalid_credentials", status: 400 },
      },
    });
    expect(await service.signInWithPassword("a@b.test", "x")).toEqual({
      ok: false,
      reason: "invalid_credentials",
    });
  });

  it("déconnecte et refuse un compte désactivé ou sans profil", async () => {
    const disabled = setup({ profile: { ...profile, isActive: false } });
    expect(await disabled.service.signInWithPassword("a@b.test", "x")).toEqual({
      ok: false,
      reason: "disabled",
    });
    expect(disabled.auth.signOut).toHaveBeenCalled();

    const missing = setup({ profile: null });
    expect(await missing.service.signInWithPassword("a@b.test", "x")).toEqual({
      ok: false,
      reason: "invalid_credentials",
    });
    expect(missing.auth.signOut).toHaveBeenCalled();
  });

  it("vérifie l'identité avec getUser (jamais getSession)", async () => {
    const { service, auth } = setup({});
    expect(await service.getAuthenticatedUserId()).toBe("user-1");
    expect(auth.getUser).toHaveBeenCalled();
    expect("getSession" in auth).toBe(false);

    const anonymous = setup({
      getUser: { data: { user: null }, error: { code: "bad_jwt" } },
    });
    expect(await anonymous.service.getAuthenticatedUserId()).toBeNull();
  });

  it("revérifie le mot de passe actuel avant de le changer", async () => {
    const { service, auth } = setup({});
    expect(await service.updatePassword("user-1", "actuel", "nouveau")).toEqual(
      {
        ok: true,
      },
    );
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.test",
      password: "actuel",
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "nouveau" });
  });

  it("refuse le changement si le mot de passe actuel est faux, sans appeler updateUser", async () => {
    const { service, auth } = setup({
      signIn: {
        data: { user: null },
        error: { code: "invalid_credentials", status: 400 },
      },
    });
    expect(await service.updatePassword("user-1", "faux", "nouveau")).toEqual({
      ok: false,
      reason: "wrong_current_password",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("refuse de changer le mot de passe d'un autre utilisateur", async () => {
    const { service, auth } = setup({});
    expect(await service.updatePassword("autre", "a", "b")).toEqual({
      ok: false,
      reason: "unexpected",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});
