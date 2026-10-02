import { describe, expect, it } from "vitest";

import { validateNewPassword } from "@/lib/auth/password-policy";

const base = {
  currentPassword: "Ancien-Mot-De-Passe-1",
  email: "jean.dupont@carrefour.test",
};

describe("validateNewPassword", () => {
  it("accepte un mot de passe valide sans règle de composition", () => {
    expect(
      validateNewPassword({ ...base, newPassword: "tout en minuscules ok" }),
    ).toEqual({ ok: true });
  });

  it("refuse un mot de passe trop court", () => {
    const result = validateNewPassword({ ...base, newPassword: "court" });
    expect(result).toEqual({
      ok: false,
      error: "Le mot de passe doit contenir au moins 12 caractères.",
    });
  });

  it("refuse un mot de passe trop long", () => {
    const result = validateNewPassword({
      ...base,
      newPassword: "x".repeat(129),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("128");
  });

  it("accepte exactement 12 et 128 caractères", () => {
    expect(
      validateNewPassword({ ...base, newPassword: "x".repeat(12) }).ok,
    ).toBe(true);
    expect(
      validateNewPassword({ ...base, newPassword: "x".repeat(128) }).ok,
    ).toBe(true);
  });

  it("refuse un mot de passe identique à l'actuel", () => {
    const result = validateNewPassword({
      ...base,
      newPassword: base.currentPassword,
    });
    expect(result).toEqual({
      ok: false,
      error: "Le nouveau mot de passe doit être différent de l'actuel.",
    });
  });

  it("refuse un mot de passe contenant la partie locale de l'email, casse ignorée", () => {
    const result = validateNewPassword({
      ...base,
      newPassword: "Mon-JEAN.Dupont-2025",
    });
    expect(result).toEqual({
      ok: false,
      error: "Le mot de passe ne doit pas contenir votre identifiant email.",
    });
  });
});
