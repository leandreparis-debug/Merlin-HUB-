import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/auth/redirect";

describe("safeRedirectPath", () => {
  it.each(["/", "/admin", "/a?b=1", "/change-password"])(
    "accepte %s",
    (path) => {
      expect(safeRedirectPath(path)).toBe(path);
    },
  );

  it.each([
    "//evil.com",
    "https://evil.com",
    "/\\evil",
    "javascript:alert(1)",
    "",
    "evil.com",
    "/\t/evil.com",
    "/a\nb",
    "/login",
    "/login?next=%2F",
  ])("rejette %j", (path) => {
    expect(safeRedirectPath(path)).toBe("/");
  });

  it("rejette null, undefined et les valeurs non textuelles", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath(["/admin"])).toBe("/");
  });

  it("rejette les chemins de plus de 200 caractères, accepte 200", () => {
    expect(safeRedirectPath("/" + "a".repeat(200))).toBe("/");
    expect(safeRedirectPath("/" + "a".repeat(199))).toHaveLength(200);
  });
});
