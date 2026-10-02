import { describe, expect, it } from "vitest";

import {
  DELETED_USER_LABEL,
  resolveAuthor,
  summarizeApps,
  toAdminAppDetail,
  toAdminAppRows,
  toStatusEventRows,
} from "@/lib/admin/apps/view-models";
import { createDemoApps } from "@/lib/data/providers/memory/demo-apps";
import type { AppStatusEvent } from "@/lib/data/types";

const NOW = new Date("2026-06-15T12:00:00Z");

describe("toAdminAppRows", () => {
  const apps = createDemoApps(NOW);

  it("inclut les apps masquées, triées, avec les possibilités de déplacement aux extrémités", () => {
    const rows = toAdminAppRows([...apps].reverse(), NOW);
    expect(rows).toHaveLength(6);
    expect(rows.at(-1)).toMatchObject({
      name: "App masquée de test",
      isHidden: true,
    });
    expect(rows[0]).toMatchObject({ canMoveUp: false, canMoveDown: true });
    expect(rows.at(-1)).toMatchObject({ canMoveUp: true, canMoveDown: false });
    expect(rows[2]).toMatchObject({ hasUrl: false });
  });

  it("est sérialisable, déterministe et sans champ superflu", () => {
    const rows = toAdminAppRows(apps, NOW);
    expect(JSON.parse(JSON.stringify(rows))).toEqual(rows);
    expect(rows[0]?.statusUpdatedLabel).toBe("il y a 2 h");
    expect(Object.keys(rows[0] ?? {})).not.toContain("url");
    expect(Object.keys(rows[0] ?? {})).not.toContain("ownerEmail");
  });
});

describe("toAdminAppDetail", () => {
  it("fournit des dates relative et absolue (Europe/Paris) déterministes", () => {
    const [first] = createDemoApps(NOW);
    const detail = toAdminAppDetail(first!, NOW);
    expect(detail.statusUpdatedLabel).toBe("il y a 2 h");
    // 10:00 UTC = 12:00 à Paris en juin.
    expect(detail.statusUpdatedAbsolute).toContain("12:00");
    expect(detail.url).toBe("https://example.test/outil-entrepots");
    expect(JSON.parse(JSON.stringify(detail))).toEqual(detail);
  });
});

describe("résolution des auteurs", () => {
  const profiles = new Map([
    ["u1", { fullName: "Alex Admin", email: "alex@example.test" }],
    ["u2", { fullName: null, email: "sans-nom@example.test" }],
  ]);

  it("retourne le nom, sinon l'email, sinon un libellé de repli ; null si non renseigné", () => {
    expect(resolveAuthor("u1", profiles)).toBe("Alex Admin");
    expect(resolveAuthor("u2", profiles)).toBe("sans-nom@example.test");
    expect(resolveAuthor("inconnu", profiles)).toBe(DELETED_USER_LABEL);
    expect(resolveAuthor(null, profiles)).toBeNull();
  });

  it("construit les lignes d'événements avec nom d'app et dates", () => {
    const events: AppStatusEvent[] = [
      {
        id: "e1",
        appId: "a1",
        previousStatus: "offline",
        newStatus: "maintenance",
        note: "Mise à jour",
        changedBy: "u1",
        changedAt: "2026-06-15T10:00:00Z",
      },
      {
        id: "e2",
        appId: "supprimee",
        previousStatus: null,
        newStatus: "online",
        note: null,
        changedBy: "disparu",
        changedAt: "2026-06-14T11:00:00Z",
      },
    ];
    const rows = toStatusEventRows(
      events,
      new Map([["a1", "Outil"]]),
      profiles,
      NOW,
    );
    expect(rows[0]).toMatchObject({
      appName: "Outil",
      author: "Alex Admin",
      relativeDate: "il y a 2 h",
    });
    expect(rows[1]).toMatchObject({
      appName: "Application supprimée",
      author: DELETED_USER_LABEL,
      relativeDate: "hier",
    });
  });
});

describe("summarizeApps", () => {
  it("compte total, visibles, masquées, statuts et apps sans URL", () => {
    expect(summarizeApps(createDemoApps(NOW))).toEqual({
      total: 6,
      visible: 5,
      hidden: 1,
      byStatus: { online: 3, offline: 2, maintenance: 1 },
      withoutUrl: 1,
    });
  });
});
