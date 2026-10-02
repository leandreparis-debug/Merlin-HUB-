import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryRepositories } from "@/lib/data/providers/memory";
import type { App } from "@/lib/data/types";

let repos = createMemoryRepositories();
vi.mock("@/lib/data", () => ({ getUserRepositories: async () => repos }));

const { CatalogueLoadError, loadCatalogue } =
  await import("@/lib/catalogue/data");

const NOW = new Date("2026-06-15T12:00:00Z");

beforeEach(() => {
  repos = createMemoryRepositories();
});

describe("loadCatalogue", () => {
  it("ne retourne que les apps visibles, triées, sous forme de view models sérialisables", async () => {
    const b = await repos.apps.create({
      slug: "beta",
      name: "Bêta",
      url: "https://example.test/b",
    });
    await repos.apps.create({ slug: "alpha", name: "Alpha" });
    await repos.apps.create({ slug: "cachee", name: "Cachée", isHidden: true });
    await repos.apps.update(b.id, { ownerEmail: "resp@example.test" });

    const cards = await loadCatalogue(NOW);

    expect(cards.map((card) => card.name)).toEqual(["Bêta", "Alpha"]);
    expect(JSON.parse(JSON.stringify(cards))).toEqual(cards);
    expect(cards[0]).toMatchObject({
      openUrl: "https://example.test/b",
      ownerEmail: "resp@example.test",
    });
    expect(cards[1]?.openUrl).toBeNull();
    // Aucune donnée interne dans le view model.
    expect(Object.keys(cards[0] ?? {})).not.toContain("isHidden");
    expect(Object.keys(cards[0] ?? {})).not.toContain("sortOrder");
    expect(JSON.stringify(cards)).not.toContain("Cachée");
  });

  it("neutralise une URL dangereuse", async () => {
    const app = await repos.apps.create({ slug: "xx", name: "X" });
    // Simule une donnée corrompue qui aurait contourné la validation d'écriture.
    const spy = vi.spyOn(repos.apps, "listVisible").mockResolvedValue([
      {
        ...app,
        url: "javascript:alert(1)",
        docUrl: "data:text/html,x",
      } as App,
    ]);
    const [card] = await loadCatalogue(NOW);
    expect(card?.openUrl).toBeNull();
    expect(card?.docUrl).toBeNull();
    spy.mockRestore();
  });

  it("filtre aussi une app masquée renvoyée par erreur par le repository", async () => {
    const app = await repos.apps.create({ slug: "xx", name: "X" });
    vi.spyOn(repos.apps, "listVisible").mockResolvedValue([
      { ...app, isHidden: true },
    ]);
    expect(await loadCatalogue(NOW)).toEqual([]);
  });

  it("remonte une erreur générique sans détail interne quand le repository échoue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(repos.apps, "listVisible").mockRejectedValue(
      new Error("connexion refusée à db.interne:5432 (mot de passe: secret)"),
    );

    const error = await loadCatalogue(NOW).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CatalogueLoadError);
    expect((error as Error).message).not.toMatch(/db\.interne|secret|5432/);
  });
});
