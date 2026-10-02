import {
  formatAbsoluteParis,
  formatRelativeTime,
} from "@/lib/catalogue/status";
import type { Announcement } from "@/lib/data/types";

/** Longueur maximale de l'extrait affiché dans la liste d'administration. */
export const EXCERPT_LENGTH = 140;
/** Au-delà de ce nombre d'annonces épinglées publiées, l'administration avertit (l'accueil n'en montre que 3). */
export const PINNED_WARNING_THRESHOLD = 3;

/** Ligne de la liste d'administration (objet simple, sérialisable). */
export interface AdminAnnouncementRow {
  id: string;
  title: string;
  excerpt: string;
  isPublished: boolean;
  isPinned: boolean;
  /** « publiée il y a 2 h » ou « jamais publiée » (brouillon). */
  dateLabel: string;
}

/** Fiche d'administration d'une annonce (valeurs du formulaire d'édition). */
export interface AdminAnnouncementDetail {
  id: string;
  title: string;
  text: string;
  isPinned: boolean;
  isPublished: boolean;
  /** « publiée il y a 2 h » ou « jamais publiée ». */
  publishedLabel: string;
  publishedAbsolute: string;
  publishedAt: string | null;
  /** Date ISO de dernière écriture (clé de rechargement des formulaires). */
  updatedAt: string;
}

/** Compteurs du tableau de bord. */
export interface AnnouncementSummary {
  published: number;
  pinned: number;
  drafts: number;
}

/** Extrait d'une ligne du texte, tronqué avec « … ». */
export function excerptOf(
  text: string,
  length: number = EXCERPT_LENGTH,
): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= length ? flat : `${flat.slice(0, length).trimEnd()}…`;
}

function publishedLabel(announcement: Announcement, now: Date): string {
  if (!announcement.publishedAt) return "jamais publiée";
  const relative = formatRelativeTime(announcement.publishedAt, now);
  return relative ? `publiée ${relative}` : "";
}

/** Annonces du domaine → lignes de la liste (l'ordre reçu est conservé). */
export function toAdminAnnouncementRows(
  announcements: readonly Announcement[],
  now: Date,
): AdminAnnouncementRow[] {
  return announcements.map((announcement) => ({
    id: announcement.id,
    title: announcement.title,
    excerpt: excerptOf(announcement.body),
    isPublished: announcement.isPublished,
    isPinned: announcement.isPinned,
    dateLabel: publishedLabel(announcement, now),
  }));
}

/** Annonce du domaine → fiche d'édition. */
export function toAdminAnnouncementDetail(
  announcement: Announcement,
  now: Date,
): AdminAnnouncementDetail {
  return {
    id: announcement.id,
    title: announcement.title,
    text: announcement.body,
    isPinned: announcement.isPinned,
    isPublished: announcement.isPublished,
    publishedLabel: publishedLabel(announcement, now),
    publishedAbsolute: announcement.publishedAt
      ? formatAbsoluteParis(announcement.publishedAt)
      : "",
    publishedAt: announcement.publishedAt,
    updatedAt: announcement.updatedAt,
  };
}

/** Nombre d'annonces épinglées **et publiées** (seules visibles côté utilisateur). */
export function countPinnedPublished(
  announcements: readonly Pick<Announcement, "isPinned" | "isPublished">[],
): number {
  return announcements.filter((a) => a.isPinned && a.isPublished).length;
}

/** Compteurs publiées / épinglées / brouillons. */
export function summarizeAnnouncements(
  announcements: readonly Pick<Announcement, "isPinned" | "isPublished">[],
): AnnouncementSummary {
  return {
    published: announcements.filter((a) => a.isPublished).length,
    pinned: countPinnedPublished(announcements),
    drafts: announcements.filter((a) => !a.isPublished).length,
  };
}
