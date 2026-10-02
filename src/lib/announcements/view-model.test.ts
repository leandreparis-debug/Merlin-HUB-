import { describe, expect, it } from "vitest";

import {
  ANNOUNCEMENT_FOLD_LENGTH,
  selectHomeAnnouncements,
  splitAnnouncementText,
  toAnnouncementCardModel,
} from "@/lib/announcements/view-model";
import type { Announcement } from "@/lib/data/types";

const NOW = new Date("2026-06-15T12:00:00Z");

function announcement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: "a",
    title: "Titre",
    body: "Texte",
    isPinned: false,
    isPublished: true,
    publishedAt: "2026-06-15T10:00:00Z",
    createdBy: "00000000-0000-4000-8000-000000000001",
    createdAt: "2026-06-15T09:00:00Z",
    updatedAt: "2026-06-15T09:00:00Z",
    ...overrides,
  };
}

describe("toAnnouncementCardModel", () => {
  it("ne contient ni isPublished ni createdBy, et reste sérialisable", () => {
    const model = toAnnouncementCardModel(announcement(), NOW);

    expect(Object.keys(model)).not.toContain("isPublished");
    expect(Object.keys(model)).not.toContain("createdBy");
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
    expect(model).toMatchObject({
      title: "Titre",
      text: "Texte",
      pinned: false,
      publishedLabel: "publiée il y a 2 h",
    });
    expect(model.publishedAbsolute).toMatch(/2026/);
  });
});

describe("splitAnnouncementText", () => {
  it("ne replie pas un texte de 280 caractères ou moins", () => {
    const text = "x".repeat(ANNOUNCEMENT_FOLD_LENGTH);
    expect(splitAnnouncementText(text)).toEqual({ head: text, tail: "" });
  });

  it("replie au-delà de 280 caractères, de préférence à une frontière de mot, sans rien perdre", () => {
    const text = `${"mot ".repeat(100)}fin`;
    const { head, tail } = splitAnnouncementText(text);
    expect(head.length).toBeLessThanOrEqual(ANNOUNCEMENT_FOLD_LENGTH);
    expect(tail).not.toBe("");
    expect(head + tail).toBe(text);
  });
});

describe("selectHomeAnnouncements", () => {
  const make = (pinned: number, others: number) => [
    ...Array.from({ length: pinned }, (_, i) =>
      announcement({ id: `p${i}`, isPinned: true }),
    ),
    ...Array.from({ length: others }, (_, i) => announcement({ id: `n${i}` })),
  ];

  it("3 épinglées au plus, complétées par les plus récentes jusqu'à 5", () => {
    const { items, hasMore } = selectHomeAnnouncements(make(5, 10));
    expect(items.map((a) => a.id)).toEqual(["p0", "p1", "p2", "n0", "n1"]);
    expect(hasMore).toBe(true);
  });

  it("1 épinglée + 4 autres = 5 ; pas de lien si tout est affiché", () => {
    const { items, hasMore } = selectHomeAnnouncements(make(1, 4));
    expect(items).toHaveLength(5);
    expect(hasMore).toBe(false);
  });

  it("au-delà de 5, hasMore est vrai", () => {
    expect(selectHomeAnnouncements(make(0, 6)).hasMore).toBe(true);
  });

  it("liste vide", () => {
    expect(selectHomeAnnouncements([])).toEqual({ items: [], hasMore: false });
  });
});
