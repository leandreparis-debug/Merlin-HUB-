import "server-only";

import { z } from "zod";

import {
  summarizeUsers,
  toActivityRows,
  toAdminUserDetail,
  toAdminUserRows,
  type ActivityRow,
  type AdminUserDetail,
  type AdminUserRow,
  type UserSummary,
} from "@/lib/admin/users/view-models";
import { getAdminRepositories } from "@/lib/data";
import { isNotFoundError } from "@/lib/data/errors";

/**
 * Chargeurs de données de l'administration des utilisateurs. Ils utilisent le
 * service role : **à n'appeler qu'après `requireAdmin()`** (pages d'administration).
 * Ils ne retournent que des view models sérialisables.
 */

/** Tous les comptes (actifs et désactivés) pour la liste. */
export async function loadUserRows(
  actorId: string,
  now: Date = new Date(),
): Promise<AdminUserRow[]> {
  const profiles = await getAdminRepositories().profiles.list({
    includeInactive: true,
  });
  return toAdminUserRows(profiles, actorId, now);
}

/** Compteurs des comptes pour le tableau de bord. */
export async function loadUserSummary(): Promise<UserSummary> {
  const profiles = await getAdminRepositories().profiles.list({
    includeInactive: true,
  });
  return summarizeUsers(profiles);
}

const idSchema = z.string().uuid();

/** Fiche d'un utilisateur et ses 20 dernières actions ; `null` si l'id est mal formé ou inconnu. */
export async function loadUserDetail(
  id: string,
  actorId: string,
  now: Date = new Date(),
): Promise<{ user: AdminUserDetail; activity: ActivityRow[] } | null> {
  if (!idSchema.safeParse(id).success) return null;
  const repositories = getAdminRepositories();
  try {
    const profile = await repositories.profiles.getById(id);
    const [activeAdminCount, entries] = await Promise.all([
      repositories.profiles.countActiveAdmins(),
      repositories.activityLog.list({ actorId: id, limit: 20 }),
    ]);
    return {
      user: toAdminUserDetail(profile, actorId, activeAdminCount, now),
      activity: toActivityRows(entries, now),
    };
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}
