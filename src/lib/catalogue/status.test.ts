import { describe, expect, it } from "vitest";

import {
  formatRelativeTime,
  statusLabel,
  updatedLabel,
} from "@/lib/catalogue/status";

const NOW = new Date("2026-06-15T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("statusLabel", () => {
  it("donne les libellés français", () => {
    expect(statusLabel("online")).toBe("En ligne");
    expect(statusLabel("offline")).toBe("Hors ligne");
    expect(statusLabel("maintenance")).toBe("Maintenance");
  });
});

describe("formatRelativeTime", () => {
  it.each([
    [10_000, "à l'instant"],
    [5 * MIN, "il y a 5 min"],
    [2 * HOUR, "il y a 2 h"],
    [26 * HOUR, "hier"],
    [3 * DAY, "il y a 3 j"],
    [15 * DAY, "il y a 2 sem."],
    [90 * DAY, "il y a 3 mois"],
  ])("%d ms → %s", (elapsed, expected) => {
    expect(formatRelativeTime(ago(elapsed), NOW)).toBe(expected);
  });

  it("traite une date future comme « à l'instant » et une date invalide comme vide", () => {
    expect(formatRelativeTime(ago(-HOUR), NOW)).toBe("à l'instant");
    expect(formatRelativeTime("n'importe quoi", NOW)).toBe("");
  });
});

describe("updatedLabel", () => {
  it("préfixe par « mis à jour »", () => {
    expect(updatedLabel(ago(2 * HOUR), NOW)).toBe("mis à jour il y a 2 h");
    expect(updatedLabel(ago(0), NOW)).toBe("mis à jour à l'instant");
    expect(updatedLabel("invalide", NOW)).toBe("");
  });
});
