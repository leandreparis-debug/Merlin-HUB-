import "server-only";

import {
  summarizeApps,
  toAdminAppDetail,
  toAdminAppRows,
  toStatusEventRows,
  type AdminAppDetail,
  type AdminAppRow,
  type DashboardSummary,
  type StatusEventRow,
} from "@/lib/admin/apps/view-models";
import { NotFoundError } from "@/lib/data/errors";
import { getAdminRepositories } from "@/lib/data";
import { z } from "zod";

/**
 * Chargeurs de données de l'administration des applications. Ils utilisent le
 * service role : **à n'appeler qu'après `requireAdmin()`** (pages d'administration).
 * Ils ne retournent que des view models sérialisables.
 */

async function profileMap() {
  const profiles = await getAdminRepositories().profiles.list({
    includeInactive: true,
  });
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

/** Tableau de bord : compteurs et 10 derniers changements de statut. */
export async function loadAdminDashboard(now: Date = new Date()): Promise<{
  summary: DashboardSummary;
  events: StatusEventRow[];
}> {
  const repositories = getAdminRepositories();
  const [apps, events, profiles] = await Promise.all([
    repositories.apps.listAll(),
    repositories.apps.listRecentStatusEvents({ limit: 10 }),
    profileMap(),
  ]);
  const names = new Map(apps.map((app) => [app.id, app.name]));
  return {
    summary: summarizeApps(apps),
    events: toStatusEventRows(events, names, profiles, now),
  };
}

/** Toutes les applications (masquées incluses) pour la liste d'administration. */
export async function loadAdminAppRows(
  now: Date = new Date(),
): Promise<AdminAppRow[]> {
  return toAdminAppRows(await getAdminRepositories().apps.listAll(), now);
}

/** Catégories existantes (suggestions du formulaire), triées. */
export async function loadCategories(): Promise<string[]> {
  const apps = await getAdminRepositories().apps.listAll();
  return [...new Set(apps.map((app) => app.category).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "fr"),
  );
}

const idSchema = z.string().uuid();

/** Fiche d'une application et son journal de statut (50 derniers événements) ; `null` si l'id est mal formé ou inconnu. */
export async function loadAdminAppDetail(
  id: string,
  now: Date = new Date(),
): Promise<{ app: AdminAppDetail; events: StatusEventRow[] } | null> {
  if (!idSchema.safeParse(id).success) return null;
  const repositories = getAdminRepositories();
  try {
    const app = await repositories.apps.getById(id);
    const [events, profiles] = await Promise.all([
      repositories.apps.listStatusEvents(id, { limit: 50 }),
      profileMap(),
    ]);
    return {
      app: toAdminAppDetail(app, now),
      events: toStatusEventRows(
        events,
        new Map([[id, app.name]]),
        profiles,
        now,
      ),
    };
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}
