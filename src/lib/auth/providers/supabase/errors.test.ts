import { describe, expect, it } from "vitest";

import { translateAuthError } from "@/lib/auth/providers/supabase/errors";

describe("translateAuthError", () => {
  it("traduit des identifiants invalides", () => {
    expect(
      translateAuthError({ code: "invalid_credentials", status: 400 }),
    ).toEqual({ reason: "invalid_credentials" });
  });

  it.each([
    { code: "over_request_rate_limit", status: 429 },
    { code: "over_email_send_rate_limit", status: 429 },
    { status: 429 },
  ])("traduit la limitation de débit (%j) avec le message dédié", (error) => {
    expect(translateAuthError(error)).toEqual({
      reason: "unexpected",
      message: "Trop de tentatives, réessayez dans quelques minutes",
    });
  });

  it("traduit toute erreur inconnue en `unexpected` sans fuite de détails", () => {
    const result = translateAuthError({
      code: "database_exploded",
      status: 500,
    });
    expect(result).toEqual({ reason: "unexpected" });
    expect(JSON.stringify(result)).not.toContain("database_exploded");
  });

  it("n'interprète pas un compte banni comme une raison spécifique", () => {
    expect(translateAuthError({ code: "user_banned", status: 400 })).toEqual({
      reason: "unexpected",
    });
  });
});
