import "server-only";

import { z } from "zod";

import {
  countPinnedPublished,
  summarizeAnnouncements,
  toAdminAnnouncementDetail,
  toAdminAnnouncementRows,
  type AdminAnnouncementDetail,
  type AdminAnnouncementRow,
  type AnnouncementSummary,
} from "@/lib/admin/announcements/view-models";
import { getAdminRepositories } from "@/lib/data";
import { isNotFoundError } from "@/lib/data/errors";

/**
 * Chargeurs de données de l'administration des annonces. Ils utilisent le
 * service role : **à n'appeler qu'après `requireAdmin()`** (pages d'administration).
 * Ils ne retournent que des view models sérialisables.
 */

/** Toutes les annonces (brouillons inclus) pour la liste, plus le nombre d'épinglées publiées. */
export async function loadAdminAnnouncementRows(
  now: Date = new Date(),
): Promise<{ rows: AdminAnnouncementRow[]; pinnedCount: number }> {
  const all = await getAdminRepositories().announcements.listAll();
  return {
    rows: toAdminAnnouncementRows(all, now),
    pinnedCount: countPinnedPublished(all),
  };
}

/** Compteurs du tableau de bord (publiées, épinglées, brouillons). */
export async function loadAnnouncementSummary(): Promise<AnnouncementSummary> {
  return summarizeAnnouncements(
    await getAdminRepositories().announcements.listAll(),
  );
}

/** Nombre d'annonces épinglées publiées (avertissement des formulaires). */
export async function loadPinnedCount(): Promise<number> {
  return countPinnedPublished(
    await getAdminRepositories().announcements.listAll(),
  );
}

const idSchema = z.string().uuid();

/** Fiche d'une annonce et nombre d'épinglées publiées ; `null` si l'id est mal formé ou inconnu. */
export async function loadAdminAnnouncementDetail(
  id: string,
  now: Date = new Date(),
): Promise<{
  announcement: AdminAnnouncementDetail;
  pinnedCount: number;
} | null> {
  if (!idSchema.safeParse(id).success) return null;
  const repositories = getAdminRepositories();
  try {
    const announcement = await repositories.announcements.getById(id);
    const all = await repositories.announcements.listAll();
    return {
      announcement: toAdminAnnouncementDetail(announcement, now),
      pinnedCount: countPinnedPublished(all),
    };
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}
