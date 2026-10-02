import {
  formatAbsoluteParis,
  formatRelativeTime,
} from "@/lib/catalogue/status";
import type { Announcement } from "@/lib/data/types";

/** Longueur au-delà de laquelle le texte d'une annonce est replié (« Lire la suite »). */
export const ANNOUNCEMENT_FOLD_LENGTH = 280;
/** Nombre maximal d'annonces épinglées affichées sur l'accueil. */
export const HOME_MAX_PINNED = 3;
/** Nombre maximal d'annonces affichées sur l'accueil (épinglées comprises). */
export const HOME_MAX_ANNOUNCEMENTS = 5;
/** Nombre maximal d'annonces listées sur `/announcements`. */
export const ANNOUNCEMENTS_PAGE_CAP = 100;

/**
 * Annonce envoyée au navigateur : objet simple et sérialisable, limité à ce
 * qui est affiché. Jamais `isPublished`, `createdBy` ni dates techniques.
 */
export interface AnnouncementCardModel {
  id: string;
  title: string;
  /** Texte brut (retours à la ligne conservés). */
  text: string;
  pinned: boolean;
  /** « publiée il y a 2 h », calculé côté serveur. */
  publishedLabel: string;
  /** Date absolue Europe/Paris, calculée côté serveur. */
  publishedAbsolute: string;
  /** Date ISO pour l'attribut `datetime`. */
  publishedAt: string;
}

/** Annonce du domaine → view model (date de première publication, à défaut de création). */
export function toAnnouncementCardModel(
  announcement: Announcement,
  now: Date,
): AnnouncementCardModel {
  const iso = announcement.publishedAt ?? announcement.createdAt;
  const relative = formatRelativeTime(iso, now);
  return {
    id: announcement.id,
    title: announcement.title,
    text: announcement.body,
    pinned: announcement.isPinned,
    publishedLabel: relative ? `publiée ${relative}` : "",
    publishedAbsolute: formatAbsoluteParis(iso),
    publishedAt: iso,
  };
}

/** Coupe `text` à `limit` caractères au plus, de préférence à une frontière de mot. */
export function splitAnnouncementText(
  text: string,
  limit: number = ANNOUNCEMENT_FOLD_LENGTH,
): { head: string; tail: string } {
  if (text.length <= limit) return { head: text, tail: "" };
  const slice = text.slice(0, limit);
  const boundary = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\n"));
  const cut = boundary > limit / 2 ? boundary : limit;
  return { head: text.slice(0, cut), tail: text.slice(cut) };
}

/**
 * Sélection de l'accueil : au plus 3 épinglées, complétées par les
 * non-épinglées les plus récentes, 5 au total. `hasMore` signale des
 * annonces publiées non affichées (lien « Toutes les annonces »).
 * `published` est supposé déjà trié (épinglées d'abord, puis récentes).
 */
export function selectHomeAnnouncements<T extends { isPinned: boolean }>(
  published: readonly T[],
): { items: T[]; hasMore: boolean } {
  const pinned = published
    .filter((announcement) => announcement.isPinned)
    .slice(0, HOME_MAX_PINNED);
  const others = published
    .filter((announcement) => !announcement.isPinned)
    .slice(0, HOME_MAX_ANNOUNCEMENTS - pinned.length);
  const items = [...pinned, ...others];
  return { items, hasMore: published.length > items.length };
}
