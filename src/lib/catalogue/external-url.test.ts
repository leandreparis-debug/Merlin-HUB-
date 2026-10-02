import { describe, expect, it } from "vitest";

import { safeEmail, safeExternalUrl } from "@/lib/catalogue/external-url";

describe("safeExternalUrl", () => {
  it("accepte http: et https:", () => {
    expect(safeExternalUrl("https://example.test/app")).toBe(
      "https://example.test/app",
    );
    expect(safeExternalUrl("http://example.test")).toBe("http://example.test/");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://example.test/fichier",
    "file:///etc/passwd",
    "mailto:a@example.test",
    "",
    "   ",
    "pas une url",
    "//example.test",
    "/chemin/relatif",
  ])("refuse %j", (url) => {
    expect(safeExternalUrl(url)).toBeNull();
  });

  it("refuse null et undefined", () => {
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
  });
});

describe("safeEmail", () => {
  it("accepte un email valide et le nettoie", () => {
    expect(safeEmail("  equipe@example.test ")).toBe("equipe@example.test");
  });

  it.each(["", "pas-un-email", "a@b", "a b@example.test", '"x"@e.test', null])(
    "refuse %j",
    (value) => {
      expect(safeEmail(value)).toBeNull();
    },
  );
});
