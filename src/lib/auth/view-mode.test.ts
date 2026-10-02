import { describe, expect, it } from "vitest";

import { resolveViewMode } from "@/lib/auth/view-mode";

describe("resolveViewMode", () => {
  it.each(["user", "admin", undefined, null, "n'importe quoi"])(
    "un utilisateur simple reste en vue utilisateur (cookie %s)",
    (cookie) => {
      expect(resolveViewMode("user", cookie)).toBe("user");
    },
  );

  it("un admin sans cookie est en vue admin", () => {
    expect(resolveViewMode("admin", undefined)).toBe("admin");
  });

  it("un admin avec le cookie « user » est en vue utilisateur", () => {
    expect(resolveViewMode("admin", "user")).toBe("user");
  });

  it("un admin avec une valeur inconnue reste en vue admin", () => {
    expect(resolveViewMode("admin", "autre")).toBe("admin");
    expect(resolveViewMode("admin", "admin")).toBe("admin");
  });
});
