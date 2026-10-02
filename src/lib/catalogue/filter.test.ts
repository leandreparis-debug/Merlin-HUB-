import { describe, expect, it } from "vitest";

import {
  categoriesOf,
  filterApps,
  parseCatalogueParams,
  sortApps,
} from "@/lib/catalogue/filter";
import { makeCard } from "@/lib/catalogue/fixtures";

const apps = [
  makeCard({
    name: "Outil entrepôts",
    category: "Entrepôts",
    description: "Pilotage des surfaces",
  }),
  makeCard({
    name: "Comptes rendus de visites",
    category: "Entrepôts",
    description: "Saisie des visites",
  }),
  makeCard({ name: "Annuaire des sites", category: "Référentiel" }),
  makeCard({
    name: "Suivi des contrôles",
    category: "Réglementaire",
    description: "Échéancier",
  }),
];
const names = (list: typeof apps) => list.map((app) => app.name);

describe("filterApps", () => {
  it("ignore la casse et les accents (« entrepots » trouve « Outil entrepôts »)", () => {
    expect(names(filterApps(apps, { q: "entrepots", cat: "" }))).toContain(
      "Outil entrepôts",
    );
    expect(names(filterApps(apps, { q: "ANNUAIRE", cat: "" }))).toEqual([
      "Annuaire des sites",
    ]);
    expect(names(filterApps(apps, { q: "echeancier", cat: "" }))).toEqual([
      "Suivi des contrôles",
    ]);
  });

  it("cherche dans la description et la catégorie", () => {
    expect(names(filterApps(apps, { q: "surfaces", cat: "" }))).toEqual([
      "Outil entrepôts",
    ]);
    expect(names(filterApps(apps, { q: "referentiel", cat: "" }))).toEqual([
      "Annuaire des sites",
    ]);
  });

  it("combine recherche et catégorie", () => {
    expect(names(filterApps(apps, { q: "visites", cat: "Entrepôts" }))).toEqual(
      ["Comptes rendus de visites"],
    );
    expect(filterApps(apps, { q: "annuaire", cat: "Entrepôts" })).toEqual([]);
  });

  it("traite une catégorie inconnue comme « toutes »", () => {
    expect(filterApps(apps, { q: "", cat: "Inconnue" })).toHaveLength(4);
  });

  it("retourne une liste vide sans résultat et conserve l'ordre d'entrée sinon", () => {
    expect(filterApps(apps, { q: "zzz", cat: "" })).toEqual([]);
    expect(names(filterApps(apps, { q: "", cat: "" }))).toEqual(names(apps));
  });
});

describe("categoriesOf", () => {
  it("retourne les catégories sans doublon, triées alphabétiquement", () => {
    expect(categoriesOf(apps)).toEqual([
      "Entrepôts",
      "Référentiel",
      "Réglementaire",
    ]);
  });
});

describe("sortApps", () => {
  it("trie par sortOrder puis par nom (ordre français)", () => {
    const sorted = sortApps([
      { sortOrder: 2, name: "Zèbre" },
      { sortOrder: 1, name: "Été" },
      { sortOrder: 1, name: "Abeille" },
      { sortOrder: 0, name: "Zoo" },
    ]);
    expect(sorted.map((item) => item.name)).toEqual([
      "Zoo",
      "Abeille",
      "Été",
      "Zèbre",
    ]);
  });
});

describe("parseCatalogueParams", () => {
  const categories = ["Entrepôts", "Référentiel"];

  it("accepte des paramètres valides", () => {
    expect(
      parseCatalogueParams({ q: "visites", cat: "Entrepôts" }, categories),
    ).toEqual({ q: "visites", cat: "Entrepôts" });
  });

  it("rejette une catégorie inconnue, limite la longueur de q et nettoie les caractères de contrôle", () => {
    expect(parseCatalogueParams({ cat: "Inconnue" }, categories).cat).toBe("");
    expect(
      parseCatalogueParams({ q: "x".repeat(500) }, categories).q,
    ).toHaveLength(100);
    expect(parseCatalogueParams({ q: "a\u0000b" }, categories).q).toBe("a b");
  });

  it("prend la première valeur d'un paramètre répété et gère l'absence", () => {
    expect(parseCatalogueParams({ q: ["un", "deux"] }, categories).q).toBe(
      "un",
    );
    expect(parseCatalogueParams({}, categories)).toEqual({ q: "", cat: "" });
  });
});
