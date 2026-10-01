import { describe, expect, it } from "vitest";

import {
  activityLogEntryFromRow,
  appFromRow,
  appStatusEventFromRow,
  createAppInputToRow,
  profileFromRow,
  recordActivityLogInputToRow,
  updateAppInputToRow,
  updateProfileInputToRow,
  type ActivityLogRow,
  type AppRow,
  type AppStatusEventRow,
  type ProfileRow,
} from "@/lib/data/providers/supabase/rows";

describe("profileFromRow", () => {
  it("convertit une ligne profiles avec des valeurs nulles", () => {
    const row: ProfileRow = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "user@example.com",
      full_name: null,
      role: "user",
      must_change_password: true,
      is_active: true,
      last_login_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    expect(profileFromRow(row)).toEqual({
      id: row.id,
      email: row.email,
      fullName: null,
      role: "user",
      mustChangePassword: true,
      isActive: true,
      lastLoginAt: null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });
});

describe("updateProfileInputToRow", () => {
  it("n'inclut que les champs fournis", () => {
    expect(updateProfileInputToRow({ isActive: false })).toEqual({
      is_active: false,
    });
    expect(updateProfileInputToRow({})).toEqual({});
  });
});

describe("appFromRow / createAppInputToRow / updateAppInputToRow", () => {
  const row: AppRow = {
    id: "00000000-0000-4000-8000-000000000002",
    slug: "mon-app",
    name: "Mon application",
    description: "",
    icon: "app-window",
    category: "Général",
    url: null,
    version: null,
    is_new: false,
    owner_name: null,
    owner_email: null,
    doc_url: null,
    status: "offline",
    status_message: null,
    status_updated_at: "2026-01-01T00:00:00.000Z",
    sort_order: 0,
    is_hidden: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };

  it("convertit une ligne apps vers le domaine", () => {
    const app = appFromRow(row);
    expect(app.id).toBe(row.id);
    expect(app.sortOrder).toBe(0);
    expect(app.statusUpdatedAt).toBe(row.status_updated_at);
    expect(app.isHidden).toBe(false);
  });

  it("createAppInputToRow convertit le camelCase en snake_case", () => {
    expect(
      createAppInputToRow({
        slug: "mon-app",
        name: "Mon application",
        ownerEmail: "proprietaire@exemple.fr",
        isHidden: true,
      }),
    ).toEqual({
      slug: "mon-app",
      name: "Mon application",
      owner_email: "proprietaire@exemple.fr",
      is_hidden: true,
    });
  });

  it("updateAppInputToRow n'inclut que les champs fournis, y compris les valeurs null explicites", () => {
    expect(updateAppInputToRow({ url: null })).toEqual({ url: null });
    expect(updateAppInputToRow({})).toEqual({});
  });
});

describe("appStatusEventFromRow", () => {
  it("convertit une ligne app_status_events", () => {
    const row: AppStatusEventRow = {
      id: "00000000-0000-4000-8000-000000000003",
      app_id: "00000000-0000-4000-8000-000000000002",
      previous_status: "offline",
      new_status: "online",
      note: "Mise en service",
      changed_by: null,
      changed_at: "2026-01-01T00:00:00.000Z",
    };

    expect(appStatusEventFromRow(row)).toEqual({
      id: row.id,
      appId: row.app_id,
      previousStatus: "offline",
      newStatus: "online",
      note: "Mise en service",
      changedBy: null,
      changedAt: row.changed_at,
    });
  });
});

describe("activityLogEntryFromRow / recordActivityLogInputToRow", () => {
  it("convertit une ligne activity_log", () => {
    const row: ActivityLogRow = {
      id: "00000000-0000-4000-8000-000000000004",
      actor_id: null,
      actor_email: null,
      action: "auth.login",
      entity_type: null,
      entity_id: null,
      metadata: { ip: "127.0.0.1" },
      created_at: "2026-01-01T00:00:00.000Z",
    };

    expect(activityLogEntryFromRow(row)).toEqual({
      id: row.id,
      actorId: null,
      actorEmail: null,
      action: "auth.login",
      entityType: null,
      entityId: null,
      metadata: { ip: "127.0.0.1" },
      createdAt: row.created_at,
    });
  });

  it("recordActivityLogInputToRow applique des valeurs par défaut sûres", () => {
    expect(recordActivityLogInputToRow({ action: "auth.login" })).toEqual({
      actor_id: null,
      actor_email: null,
      action: "auth.login",
      entity_type: null,
      entity_id: null,
      metadata: {},
    });
  });
});
