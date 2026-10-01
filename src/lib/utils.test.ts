import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("fusionne plusieurs classes", () => {
    expect(cn("flex", "items-center")).toBe("flex items-center");
  });

  it("résout les conflits de classes Tailwind (la dernière l'emporte)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignore les valeurs falsy", () => {
    expect(cn("flex", false, undefined, null, "")).toBe("flex");
  });
});
