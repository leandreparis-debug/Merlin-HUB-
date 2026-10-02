import { describe, expect, it } from "vitest";

import { filterUsers, parseUserListParams } from "@/lib/admin/users/filter";
import {
  NEVER_LOGGED_IN_LABEL,
  activityLabel,
  sortProfiles,
  summarizeUsers,
  toActivityRows,
  toAdminUserDetail,
  toAdminUserRows,
} from "@/lib/admin/users/view-models";
import type { ActivityLogEntry, Profile } from "@/lib/data/types";

const NOW = new Date("2026-06-15T12:00:00Z");

function profile(overrides: Partial<Profile> & { email: string }): Profile {
  return {
    id: overrides.id ?? overrides.email,
    fullName: null,
    role: "user",
    mustChangePassword: false,
    isActive: true,
    lastLoginAt: null,
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-02T10:00:00Z",
    ...overrides,
  };
}

const profiles = [
  profile({
    email: "zoe@example.test",
    fullName: "Zoé Martin",
    role: "admin",
    lastLoginAt: "2026-06-15T10:00:00Z",
  }),
  profile({
    email: "alice@example.test",
    fullName: "Alice Éclair",
    mustChangePassword: true,
  }),
  profile({ email: "sans-nom@example.test" }),
  profile({
    email: "off@example.test",
    fullName: "Olivier Désactivé",
    isActive: false,
  }),
];

describe("tri et view models", () => {
  it("trie par nom (sans nom en dernier) puis email", () => {
    expect(sortProfiles(profiles).map((p) => p.email)).toEqual([
      "alice@example.test",
      "off@example.test",
      "zoe@example.test",
      "sans-nom@example.test",
    ]);
  });

  it("construit des lignes sérialisables : « Vous », dates relatives déterministes, « Jamais connecté »", () => {
    const rows = toAdminUserRows(profiles, "zoe@example.test", NOW);
    expect(JSON.parse(JSON.stringify(rows))).toEqual(rows);
    expect(rows.find((r) => r.email === "zoe@example.test")).toMatchObject({
      isSelf: true,
      lastLoginLabel: "il y a 2 h",
    });
    expect(rows.find((r) => r.email === "alice@example.test")).toMatchObject({
      isSelf: false,
      lastLoginLabel: NEVER_LOGGED_IN_LABEL,
      mustChangePassword: true,
    });
  });

  it("n'expose aucun champ superflu dans une ligne", () => {
    const [row] = toAdminUserRows(profiles, "x", NOW);
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "email",
      "fullName",
      "id",
      "isActive",
      "isSelf",
      "lastLoginLabel",
      "mustChangePassword",
      "role",
    ]);
  });

  it("évalue les autorisations de la fiche avec les règles métier", () => {
    const self = toAdminUserDetail(profiles[0]!, "zoe@example.test", 1, NOW);
    expect(self.permissions.deactivate.allowed).toBe(false);
    expect(self.permissions.resetPassword.allowed).toBe(false);
    expect(self.permissions.changeRole.allowed).toBe(false);
    expect(self.lastLoginAbsolute).toContain("12:00");

    const other = toAdminUserDetail(profiles[1]!, "zoe@example.test", 1, NOW);
    expect(other.permissions.deactivate.allowed).toBe(true);
    expect(other.permissions.changeRole.allowed).toBe(true);
    expect(other.lastLoginLabel).toBe(NEVER_LOGGED_IN_LABEL);
  });

  it("compte total, actifs, admins actifs et premières connexions en attente", () => {
    expect(summarizeUsers(profiles)).toEqual({
      total: 4,
      active: 3,
      activeAdmins: 1,
      pendingFirstLogin: 1,
    });
  });

  it("traduit les actions du journal en français avec dates déterministes", () => {
    expect(activityLabel("auth.login")).toBe("Connexion");
    expect(activityLabel("user.password_reset")).toMatch(/réinitialisé/);
    expect(activityLabel("inconnue.action")).toBe("inconnue.action");
    const entry: ActivityLogEntry = {
      id: "e1",
      actorId: "u",
      actorEmail: null,
      action: "auth.login",
      entityType: null,
      entityId: null,
      metadata: {},
      createdAt: "2026-06-15T10:00:00Z",
    };
    expect(toActivityRows([entry], NOW)[0]).toMatchObject({
      label: "Connexion",
      relativeDate: "il y a 2 h",
    });
  });
});

describe("filtres de la liste", () => {
  const rows = toAdminUserRows(profiles, "zoe@example.test", NOW);
  const emails = (list: typeof rows) => list.map((r) => r.email);

  it("recherche insensible aux accents et à la casse sur le nom et l'email", () => {
    expect(emails(filterUsers(rows, { q: "ECLAIR", filter: "all" }))).toEqual([
      "alice@example.test",
    ]);
    expect(emails(filterUsers(rows, { q: "zoe", filter: "all" }))).toEqual([
      "zoe@example.test",
    ]);
    expect(
      emails(filterUsers(rows, { q: "desactive", filter: "all" })),
    ).toEqual(["off@example.test"]);
  });

  it("applique les filtres rapides et les combine avec la recherche", () => {
    expect(emails(filterUsers(rows, { q: "", filter: "inactive" }))).toEqual([
      "off@example.test",
    ]);
    expect(emails(filterUsers(rows, { q: "", filter: "admins" }))).toEqual([
      "zoe@example.test",
    ]);
    expect(emails(filterUsers(rows, { q: "", filter: "pending" }))).toEqual([
      "alice@example.test",
    ]);
    expect(filterUsers(rows, { q: "", filter: "active" })).toHaveLength(3);
    expect(filterUsers(rows, { q: "alice", filter: "admins" })).toEqual([]);
  });

  it("ignore les paramètres d'URL invalides", () => {
    expect(
      parseUserListParams({ filter: "n-importe-quoi", q: "x".repeat(500) }),
    ).toEqual({
      q: "x".repeat(100),
      filter: "all",
    });
    expect(
      parseUserListParams({ filter: ["admins", "active"], q: "a\u0000b" }),
    ).toEqual({
      q: "a b",
      filter: "admins",
    });
    expect(parseUserListParams({})).toEqual({ q: "", filter: "all" });
  });
});
