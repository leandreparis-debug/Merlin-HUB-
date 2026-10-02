import { describe, expect, it } from "vitest";

import { slugify } from "@/lib/admin/apps/slugify";
import { createAppInputSchema } from "@/lib/data/schemas";

describe("slugify", () => {
  it.each([
    ["Outil entrepôts", "outil-entrepots"],
    ["  Comptes   rendus de visites ", "comptes-rendus-de-visites"],
    [
      "Suivi des contrôles réglementaires",
      "suivi-des-controles-reglementaires",
    ],
    ["C'est l'été !", "c-est-l-ete"],
    ["a --- b", "a-b"],
    ["--début--", "debut"],
    ["App 2.0 (bêta)", "app-2-0-beta"],
  ])("%j → %s", (name, expected) => {
    expect(slugify(name)).toBe(expected);
  });

  it("limite la longueur à 60 caractères sans tiret final", () => {
    const slug = slugify(`${"a".repeat(59)} bbbbbb`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    expect(slugify("x".repeat(100))).toHaveLength(60);
  });

  it("produit un slug conforme au schéma", () => {
    const slug = slugify("Annuaire des sites — Île-de-France");
    expect(
      createAppInputSchema.safeParse({ slug, name: "Annuaire" }).success,
    ).toBe(true);
  });

  it("donne une chaîne vide (invalide pour le schéma) pour un nom vide ou sans caractère exploitable", () => {
    for (const name of ["", "   ", "!!!", "—"]) {
      const slug = slugify(name);
      expect(slug).toBe("");
      expect(createAppInputSchema.safeParse({ slug, name: "x" }).success).toBe(
        false,
      );
    }
  });
});
