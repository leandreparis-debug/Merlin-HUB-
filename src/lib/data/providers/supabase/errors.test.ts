import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  ConflictError,
  NotFoundError,
  UnexpectedRepositoryError,
  ValidationError,
} from "@/lib/data/errors";
import { translateSupabaseError } from "@/lib/data/providers/supabase/errors";

function fakeError(
  code: string,
  message = "message interne postgres",
): PostgrestError {
  const error = {
    message,
    details: "détail interne",
    hint: "",
    code,
    name: "PostgrestError",
  };
  return { ...error, toJSON: () => error } as PostgrestError;
}

describe("translateSupabaseError", () => {
  it("traduit 23505 en ConflictError", () => {
    const error = translateSupabaseError(fakeError("23505"), "Application");
    expect(error).toBeInstanceOf(ConflictError);
  });

  it("traduit PGRST116 en NotFoundError", () => {
    const error = translateSupabaseError(fakeError("PGRST116"), "Application");
    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("traduit 23514 et 22P02 en ValidationError", () => {
    expect(
      translateSupabaseError(fakeError("23514"), "Application"),
    ).toBeInstanceOf(ValidationError);
    expect(
      translateSupabaseError(fakeError("22P02"), "Application"),
    ).toBeInstanceOf(ValidationError);
  });

  it("traduit un code inconnu en UnexpectedRepositoryError sans divulguer le détail Postgres", () => {
    const original = fakeError("XX000", "détail interne sensible");
    const error = translateSupabaseError(original, "Application");

    expect(error).toBeInstanceOf(UnexpectedRepositoryError);
    expect(error.message).not.toContain("détail interne sensible");
    expect((error as UnexpectedRepositoryError).cause).toBe(original);
  });
});
