import { describe, expect, it } from "vitest";

import {
  canChangeRole,
  canDeactivate,
  canReactivate,
  canResetPassword,
  type UserRuleContext,
} from "@/lib/admin/users/user-rules";

function context(
  overrides: {
    actorId?: string;
    target?: Partial<UserRuleContext["target"]>;
    activeAdminCount?: number;
  } = {},
): UserRuleContext {
  return {
    actorId: overrides.actorId ?? "admin-a",
    target: {
      id: "target",
      role: "user",
      isActive: true,
      ...overrides.target,
    },
    activeAdminCount: overrides.activeAdminCount ?? 2,
  };
}

const self = { id: "admin-a", role: "admin" as const, isActive: true };

describe("canChangeRole", () => {
  it("refuse à un admin de modifier son propre rôle (rétrogradation)", () => {
    const result = canChangeRole(context({ target: self }), "user");
    expect(result).toMatchObject({ allowed: false });
    if (!result.allowed) expect(result.reason).toMatch(/propre rôle/);
  });

  it("refuse de rétrograder le dernier admin actif", () => {
    const result = canChangeRole(
      context({
        target: { id: "admin-b", role: "admin" },
        activeAdminCount: 1,
      }),
      "user",
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed)
      expect(result.reason).toMatch(/dernier administrateur actif/);
  });

  it("autorise la rétrogradation d'un admin quand il en reste un autre actif", () => {
    expect(
      canChangeRole(
        context({
          target: { id: "admin-b", role: "admin" },
          activeAdminCount: 2,
        }),
        "user",
      ),
    ).toEqual({ allowed: true });
  });

  it("autorise la promotion et un rôle inchangé", () => {
    expect(canChangeRole(context(), "admin")).toEqual({ allowed: true });
    expect(canChangeRole(context({ target: self }), "admin")).toEqual({
      allowed: true,
    });
  });

  it("autorise la rétrogradation d'un admin déjà désactivé (hors décompte des actifs)", () => {
    expect(
      canChangeRole(
        context({
          target: { id: "admin-b", role: "admin", isActive: false },
          activeAdminCount: 1,
        }),
        "user",
      ),
    ).toEqual({ allowed: true });
  });
});

describe("canDeactivate", () => {
  it("refuse à un admin de se désactiver lui-même", () => {
    const result = canDeactivate(context({ target: self }));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toMatch(/votre propre compte/);
  });

  it("refuse de désactiver le dernier admin actif", () => {
    const result = canDeactivate(
      context({
        target: { id: "admin-b", role: "admin" },
        activeAdminCount: 1,
      }),
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed)
      expect(result.reason).toMatch(/dernier administrateur actif/);
  });

  it("autorise quand un autre admin actif existe, et pour un utilisateur simple", () => {
    expect(
      canDeactivate(
        context({
          target: { id: "admin-b", role: "admin" },
          activeAdminCount: 2,
        }),
      ),
    ).toEqual({ allowed: true });
    expect(canDeactivate(context({ activeAdminCount: 1 }))).toEqual({
      allowed: true,
    });
  });
});

describe("canReactivate", () => {
  it("est toujours permise", () => {
    expect(canReactivate()).toEqual({ allowed: true });
  });
});

describe("canResetPassword", () => {
  it("refuse la réinitialisation de son propre mot de passe avec un message pointant vers « Changer mon mot de passe »", () => {
    const result = canResetPassword(context({ target: self }));
    expect(result.allowed).toBe(false);
    if (!result.allowed)
      expect(result.reason).toMatch(/Changer mon mot de passe/);
  });

  it("autorise la réinitialisation du mot de passe d'un autre compte, même désactivé", () => {
    expect(canResetPassword(context())).toEqual({ allowed: true });
    expect(canResetPassword(context({ target: { isActive: false } }))).toEqual({
      allowed: true,
    });
  });
});
