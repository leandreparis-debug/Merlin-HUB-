import { AppWindow, Warehouse } from "lucide-react";
import { describe, expect, it } from "vitest";

import { ICON_NAMES, resolveIcon } from "@/lib/catalogue/icons";

describe("registre d'icônes", () => {
  it("résout une icône connue", () => {
    expect(resolveIcon("warehouse")).toBe(Warehouse);
  });

  it("retombe sur app-window pour un nom inconnu, vide ou absent, sans erreur", () => {
    expect(resolveIcon("n-existe-pas")).toBe(AppWindow);
    expect(resolveIcon("")).toBe(AppWindow);
    expect(resolveIcon(null)).toBe(AppWindow);
    expect(resolveIcon(undefined)).toBe(AppWindow);
  });

  it("exporte une liste de noms sans doublon, incluant le repli, d'au moins quarante icônes", () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    expect(ICON_NAMES).toContain("app-window");
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(40);
    for (const name of ICON_NAMES) expect(resolveIcon(name)).toBeDefined();
  });
});
