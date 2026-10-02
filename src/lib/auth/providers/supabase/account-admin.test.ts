import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseAccountAdminService } from "@/lib/auth/providers/supabase/account-admin";
import { NotFoundError } from "@/lib/data/errors";
import type { ProfileRepository } from "@/lib/data/repositories/profile-repository";
import type { Profile } from "@/lib/data/types";

const USER_ID = "11111111-2222-4333-8444-555555555555";

const profile: Profile = {
  id: USER_ID,
  email: "user@example.test",
  fullName: null,
  role: "user",
  mustChangePassword: false,
  isActive: true,
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function setup(
  options: {
    createUser?: unknown;
    updateUserById?: unknown;
    deleteUser?: unknown;
    updateProfile?: () => Promise<Profile>;
    getProfile?: () => Promise<Profile>;
  } = {},
) {
  const admin = {
    createUser: vi.fn(
      async (..._args: unknown[]) =>
        options.createUser ?? { data: { user: { id: USER_ID } }, error: null },
    ),
    updateUserById: vi.fn(
      async (..._args: unknown[]) =>
        options.updateUserById ?? { data: {}, error: null },
    ),
    deleteUser: vi.fn(
      async (..._args: unknown[]) =>
        options.deleteUser ?? { data: {}, error: null },
    ),
  };
  const profiles = {
    getById: vi.fn(options.getProfile ?? (async () => profile)),
    update: vi.fn(options.updateProfile ?? (async () => profile)),
  } as unknown as ProfileRepository;
  const service = createSupabaseAccountAdminService({
    client: { auth: { admin } } as unknown as SupabaseClient,
    profiles,
  });
  return { admin, profiles, service };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => errorSpy.mockRestore());

describe("createAccount (Supabase)", () => {
  it("appelle createUser avec email confirmé et nom, puis applique rôle et mustChangePassword", async () => {
    const { admin, profiles, service } = setup();

    const result = await service.createAccount({
      email: "nouveau@example.test",
      fullName: "Nina Nouvelle",
      role: "admin",
    });

    expect(result.ok).toBe(true);
    const params = admin.createUser.mock.calls[0]?.[0] as {
      email: string;
      password: string;
      email_confirm: boolean;
      user_metadata: unknown;
    };
    expect(params).toMatchObject({
      email: "nouveau@example.test",
      email_confirm: true,
      user_metadata: { full_name: "Nina Nouvelle" },
    });
    expect(params.password).toHaveLength(20);
    expect(profiles.update).toHaveBeenCalledWith(USER_ID, {
      role: "admin",
      mustChangePassword: true,
    });
    if (result.ok) expect(result.provisionalPassword).toBe(params.password);
  });

  it.each([
    { code: "email_exists", status: 422 },
    { code: "user_already_exists", status: 422 },
  ])("traduit l'erreur « email déjà enregistré » (%j)", async (error) => {
    const { service, profiles } = setup({
      createUser: { data: { user: null }, error },
    });
    expect(
      await service.createAccount({
        email: "dup@example.test",
        fullName: null,
        role: "user",
      }),
    ).toEqual({ ok: false, reason: "email_exists" });
    expect(profiles.update).not.toHaveBeenCalled();
  });

  it("traduit une erreur inconnue en unexpected sans fuite de détail ni de mot de passe", async () => {
    const { service } = setup({
      createUser: {
        data: { user: null },
        error: { code: "boom", status: 500, message: "secret interne db:5432" },
      },
    });
    const result = await service.createAccount({
      email: "x@example.test",
      fullName: null,
      role: "user",
    });
    expect(result).toEqual({ ok: false, reason: "unexpected" });
    expect(JSON.stringify(result)).not.toContain("secret interne");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("secret interne");
  });

  it("compense en supprimant le compte Auth quand la mise à jour du profil échoue", async () => {
    const { admin, service } = setup({
      updateProfile: async () => {
        throw new Error("échec profil");
      },
    });

    const result = await service.createAccount({
      email: "partiel@example.test",
      fullName: null,
      role: "admin",
    });

    expect(admin.deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual({ ok: false, reason: "unexpected" });
  });

  it("signale maybeCreated quand la compensation échoue aussi, sans exposer d'email ni de mot de passe dans les logs", async () => {
    const { admin, service } = setup({
      updateProfile: async () => {
        throw new Error("échec profil");
      },
      deleteUser: { data: null, error: { code: "boom" } },
    });

    const result = await service.createAccount({
      email: "partiel@example.test",
      fullName: null,
      role: "admin",
    });

    expect(admin.deleteUser).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      reason: "unexpected",
      maybeCreated: true,
    });
    const password = (
      admin.createUser.mock.calls[0]?.[0] as { password: string }
    ).password;
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain(password);
    expect(logged).not.toContain("partiel@example.test");
  });
});

describe("resetPassword (Supabase)", () => {
  it("pose mustChangePassword puis change le mot de passe via updateUserById", async () => {
    const { admin, profiles, service } = setup();

    const result = await service.resetPassword(USER_ID);

    expect(result.ok).toBe(true);
    expect(profiles.update).toHaveBeenCalledWith(USER_ID, {
      mustChangePassword: true,
    });
    const [id, attributes] = admin.updateUserById.mock.calls[0] as unknown as [
      string,
      { password: string },
    ];
    expect(id).toBe(USER_ID);
    expect(attributes.password).toHaveLength(20);
    if (result.ok) expect(result.provisionalPassword).toBe(attributes.password);
  });

  it("retourne not_found pour un profil ou un utilisateur Auth inconnu", async () => {
    const missingProfile = setup({
      getProfile: async () => {
        throw new NotFoundError("Profil");
      },
    });
    expect(await missingProfile.service.resetPassword(USER_ID)).toEqual({
      ok: false,
      reason: "not_found",
    });

    const missingAuth = setup({
      updateUserById: { data: null, error: { code: "user_not_found" } },
    });
    expect(await missingAuth.service.resetPassword(USER_ID)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("traduit une erreur inconnue en unexpected sans mot de passe dans les logs", async () => {
    const { admin, service } = setup({
      updateUserById: { data: null, error: { code: "boom", status: 500 } },
    });
    expect(await service.resetPassword(USER_ID)).toEqual({
      ok: false,
      reason: "unexpected",
    });
    const password = (
      admin.updateUserById.mock.calls[0] as [string, { password: string }]
    )[1].password;
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(password);
  });
});

describe("revokeSessions (Supabase)", () => {
  it("ne lève jamais et n'appelle pas admin.signOut (qui attend un JWT)", async () => {
    const { admin, service } = setup();
    expect(await service.revokeSessions(USER_ID)).toBe(false);
    expect(Object.keys(admin)).not.toContain("signOut");
  });
});
