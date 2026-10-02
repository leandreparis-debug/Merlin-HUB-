import "server-only";

import {
  ANNOUNCEMENTS_PAGE_CAP,
  selectHomeAnnouncements,
  toAnnouncementCardModel,
  type AnnouncementCardModel,
} from "@/lib/announcements/view-model";
import { getUserRepositories } from "@/lib/data";
import type { Announcement } from "@/lib/data/types";

/** Erreur générique de lecture des annonces : aucun détail interne n'est exposé. */
export class AnnouncementsLoadError extends Error {
  constructor() {
    super("Les annonces sont momentanément indisponibles.");
    this.name = "AnnouncementsLoadError";
  }
}

/** Annonces publiées pour l'utilisateur courant (RLS appliquée), triées, dont tout élément non publié est écarté en défense en profondeur. */
async function readPublished(limit: number): Promise<Announcement[]> {
  try {
    const repositories = await getUserRepositories();
    const published = await repositories.announcements.listPublished({ limit });
    return published.filter((announcement) => announcement.isPublished);
  } catch {
    console.error("Échec de la lecture des annonces.");
    throw new AnnouncementsLoadError();
  }
}

/**
 * Annonces de la zone d'accueil (3 épinglées au plus, 5 au total) sous forme
 * de view models sérialisables ; `hasMore` si d'autres annonces existent.
 * Toute erreur devient une {@link AnnouncementsLoadError} générique.
 */
export async function loadHomeAnnouncements(
  now: Date = new Date(),
): Promise<{ items: AnnouncementCardModel[]; hasMore: boolean }> {
  const published = await readPublished(ANNOUNCEMENTS_PAGE_CAP + 1);
  const { items, hasMore } = selectHomeAnnouncements(published);
  return {
    items: items.map((announcement) =>
      toAnnouncementCardModel(announcement, now),
    ),
    hasMore,
  };
}

/**
 * Toutes les annonces publiées (100 au plus, `capped` si la limite est
 * atteinte) sous forme de view models sérialisables.
 */
export async function loadAllAnnouncements(
  now: Date = new Date(),
): Promise<{ items: AnnouncementCardModel[]; capped: boolean }> {
  const published = await readPublished(ANNOUNCEMENTS_PAGE_CAP + 1);
  const capped = published.length > ANNOUNCEMENTS_PAGE_CAP;
  return {
    items: published
      .slice(0, ANNOUNCEMENTS_PAGE_CAP)
      .map((announcement) => toAnnouncementCardModel(announcement, now)),
    capped,
  };
}
