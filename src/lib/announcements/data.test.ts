import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryRepositories } from "@/lib/data/providers/memory";
import type { Announcement } from "@/lib/data/types";

let repos = createMemoryRepositories();
vi.mock("@/lib/data", () => ({ getUserRepositories: async () => repos }));

const { AnnouncementsLoadError, loadAllAnnouncements, loadHomeAnnouncements } =
  await import("@/lib/announcements/data");

const NOW = new Date();

beforeEach(() => {
  repos = createMemoryRepositories();
  vi.restoreAllMocks();
});

describe("loadHomeAnnouncements / loadAllAnnouncements", () => {
  it("ne retourne que des annonces publiées, sans champs internes", async () => {
    await repos.announcements.create({ title: "Publiée", body: "a" });
    await repos.announcements.create({
      title: "Brouillon secret",
      body: "texte confidentiel",
      isPublished: false,
    });

    const home = await loadHomeAnnouncements(NOW);
    const all = await loadAllAnnouncements(NOW);

    for (const result of [home.items, all.items]) {
      expect(result.map((a) => a.title)).toEqual(["Publiée"]);
      expect(Object.keys(result[0] ?? {})).not.toContain("isPublished");
      expect(Object.keys(result[0] ?? {})).not.toContain("createdBy");
      expect(JSON.stringify(result)).not.toContain("confidentiel");
    }
  });

  it("écarte une annonce non publiée renvoyée par erreur par le repository", async () => {
    const draft = await repos.announcements.create({
      title: "Brouillon",
      body: "x",
      isPublished: false,
    });
    vi.spyOn(repos.announcements, "listPublished").mockResolvedValue([
      draft as Announcement,
    ]);

    expect((await loadHomeAnnouncements(NOW)).items).toEqual([]);
    expect((await loadAllAnnouncements(NOW)).items).toEqual([]);
  });

  it("applique la règle 3 épinglées + complément jusqu'à 5 sur l'accueil", async () => {
    for (let i = 0; i < 4; i += 1) {
      const a = await repos.announcements.create({
        title: `Épinglée ${i}`,
        body: "x",
      });
      await repos.announcements.setPinned(a.id, true);
    }
    for (let i = 0; i < 4; i += 1) {
      await repos.announcements.create({ title: `Normale ${i}`, body: "x" });
    }

    const { items, hasMore } = await loadHomeAnnouncements(NOW);

    expect(items).toHaveLength(5);
    expect(items.filter((a) => a.pinned)).toHaveLength(3);
    expect(items.slice(0, 3).every((a) => a.pinned)).toBe(true);
    expect(hasMore).toBe(true);
  });

  it("plafonne /announcements à 100 et le signale", async () => {
    for (let i = 0; i < 101; i += 1) {
      await repos.announcements.create({ title: `A${i}`, body: "x" });
    }
    const { items, capped } = await loadAllAnnouncements(NOW);
    expect(items).toHaveLength(100);
    expect(capped).toBe(true);
  });

  it("ne signale pas de plafond sous 100 annonces", async () => {
    await repos.announcements.create({ title: "A", body: "x" });
    expect((await loadAllAnnouncements(NOW)).capped).toBe(false);
  });

  it("transforme toute erreur en AnnouncementsLoadError générique", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(repos.announcements, "listPublished").mockRejectedValue(
      new Error("connexion postgres://secret refusée"),
    );

    for (const load of [loadHomeAnnouncements, loadAllAnnouncements]) {
      const error = await load(NOW).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(AnnouncementsLoadError);
      expect((error as Error).message).not.toContain("postgres");
    }
  });
});
