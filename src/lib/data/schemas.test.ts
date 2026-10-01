import { describe, expect, it } from "vitest";

import {
  createAppInputSchema,
  createProfileInputSchema,
  recordActivityLogInputSchema,
} from "@/lib/data/schemas";

describe("createAppInputSchema", () => {
  it("rejette un slug invalide (majuscules, espaces, trop court)", () => {
    expect(
      createAppInputSchema.safeParse({ slug: "Mon App", name: "Mon app" })
        .success,
    ).toBe(false);
    expect(
      createAppInputSchema.safeParse({ slug: "a", name: "Mon app" }).success,
    ).toBe(false);
    expect(
      createAppInputSchema.safeParse({ slug: "--", name: "Mon app" }).success,
    ).toBe(false);

    const result = createAppInputSchema.safeParse({
      slug: "Mon App",
      name: "Mon app",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("minuscules");
    }
  });

  it("accepte un slug valide", () => {
    const result = createAppInputSchema.safeParse({
      slug: "mon-application-2",
      name: "Mon application",
    });
    expect(result.success).toBe(true);
  });

  it("refuse une URL javascript: et accepte http:// et https://", () => {
    const base = { slug: "mon-app", name: "Mon app" };

    expect(
      createAppInputSchema.safeParse({ ...base, url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
    expect(
      createAppInputSchema.safeParse({ ...base, url: "data:text/html,evil" })
        .success,
    ).toBe(false);
    expect(
      createAppInputSchema.safeParse({ ...base, url: "http://exemple.fr" })
        .success,
    ).toBe(true);
    expect(
      createAppInputSchema.safeParse({ ...base, url: "https://exemple.fr" })
        .success,
    ).toBe(true);
  });

  it("rejette un nom trop long avec un message en français", () => {
    const result = createAppInputSchema.safeParse({
      slug: "mon-app",
      name: "a".repeat(81),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/80 caractères/);
    }
  });
});

describe("createProfileInputSchema", () => {
  it("normalise l'email en minuscules", () => {
    const result = createProfileInputSchema.safeParse({
      id: crypto.randomUUID(),
      email: "  USER@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejette un email invalide", () => {
    const result = createProfileInputSchema.safeParse({
      id: crypto.randomUUID(),
      email: "pas-un-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("recordActivityLogInputSchema", () => {
  it("exige le format domaine.action en minuscules", () => {
    expect(
      recordActivityLogInputSchema.safeParse({ action: "AuthLogin" }).success,
    ).toBe(false);
    expect(
      recordActivityLogInputSchema.safeParse({ action: "auth" }).success,
    ).toBe(false);
    expect(
      recordActivityLogInputSchema.safeParse({ action: "auth.login" }).success,
    ).toBe(true);
    expect(
      recordActivityLogInputSchema.safeParse({ action: "app.status_changed" })
        .success,
    ).toBe(true);
  });
});
