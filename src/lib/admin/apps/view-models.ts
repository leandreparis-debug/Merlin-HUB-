import { sortApps } from "@/lib/catalogue/filter";
import {
  formatAbsoluteParis,
  formatRelativeTime,
} from "@/lib/catalogue/status";
import type { App, AppStatus, AppStatusEvent, Profile } from "@/lib/data/types";

/** Libellé affiché quand l'auteur d'un événement n'existe plus. */
export const DELETED_USER_LABEL = "Utilisateur supprimé";

/** Ligne de la liste d'administration (objet simple, sérialisable). */
export interface AdminAppRow {
  id: string;
  name: string;
  icon: string;
  category: string;
  status: AppStatus;
  isHidden: boolean;
  version: string | null;
  isNew: boolean;
  hasUrl: boolean;
  /** « il y a 2 h » (dernier changement de statut), calculé côté serveur. */
  statusUpdatedLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/** Fiche d'administration d'une application (valeurs du formulaire d'édition). */
export interface AdminAppDetail {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  url: string;
  version: string;
  isNew: boolean;
  ownerName: string;
  ownerEmail: string;
  docUrl: string;
  isHidden: boolean;
  status: AppStatus;
  statusMessage: string;
  statusUpdatedLabel: string;
  statusUpdatedAbsolute: string;
  /** Change à chaque écriture : clé de rechargement des formulaires. */
  updatedAt: string;
}

/** Événement de statut prêt à afficher. */
export interface StatusEventRow {
  id: string;
  appId: string;
  appName: string;
  previousStatus: AppStatus | null;
  newStatus: AppStatus;
  note: string | null;
  /** Nom ou email de l'auteur, « Utilisateur supprimé » s'il n'existe plus, `null` si non renseigné. */
  author: string | null;
  absoluteDate: string;
  relativeDate: string;
}

/** Synthèse du tableau de bord. */
export interface DashboardSummary {
  total: number;
  visible: number;
  hidden: number;
  byStatus: Record<AppStatus, number>;
  withoutUrl: number;
}

/** Lignes de la liste d'administration, triées comme l'accueil (sortOrder puis nom), masquées incluses. */
export function toAdminAppRows(apps: readonly App[], now: Date): AdminAppRow[] {
  const sorted = sortApps(apps);
  return sorted.map((app, index) => ({
    id: app.id,
    name: app.name,
    icon: app.icon,
    category: app.category,
    status: app.status,
    isHidden: app.isHidden,
    version: app.version,
    isNew: app.isNew,
    hasUrl: Boolean(app.url),
    statusUpdatedLabel: formatRelativeTime(app.statusUpdatedAt, now),
    canMoveUp: index > 0,
    canMoveDown: index < sorted.length - 1,
  }));
}

/** Fiche d'administration d'une application. */
export function toAdminAppDetail(app: App, now: Date): AdminAppDetail {
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    description: app.description,
    icon: app.icon,
    category: app.category,
    url: app.url ?? "",
    version: app.version ?? "",
    isNew: app.isNew,
    ownerName: app.ownerName ?? "",
    ownerEmail: app.ownerEmail ?? "",
    docUrl: app.docUrl ?? "",
    isHidden: app.isHidden,
    status: app.status,
    statusMessage: app.statusMessage ?? "",
    statusUpdatedLabel: formatRelativeTime(app.statusUpdatedAt, now),
    statusUpdatedAbsolute: formatAbsoluteParis(app.statusUpdatedAt),
    updatedAt: app.updatedAt,
  };
}

/** Résout l'auteur d'un événement : nom, sinon email, sinon libellé de repli ; `null` si non renseigné. */
export function resolveAuthor(
  changedBy: string | null,
  profiles: ReadonlyMap<string, Pick<Profile, "fullName" | "email">>,
): string | null {
  if (!changedBy) return null;
  const profile = profiles.get(changedBy);
  if (!profile) return DELETED_USER_LABEL;
  return profile.fullName?.trim() || profile.email;
}

/** Événements de statut prêts à afficher (nom d'app et auteur résolus côté serveur). */
export function toStatusEventRows(
  events: readonly AppStatusEvent[],
  appNames: ReadonlyMap<string, string>,
  profiles: ReadonlyMap<string, Pick<Profile, "fullName" | "email">>,
  now: Date,
): StatusEventRow[] {
  return events.map((event) => ({
    id: event.id,
    appId: event.appId,
    appName: appNames.get(event.appId) ?? "Application supprimée",
    previousStatus: event.previousStatus,
    newStatus: event.newStatus,
    note: event.note,
    author: resolveAuthor(event.changedBy, profiles),
    absoluteDate: formatAbsoluteParis(event.changedAt),
    relativeDate: formatRelativeTime(event.changedAt, now),
  }));
}

/** Compteurs du tableau de bord. */
export function summarizeApps(apps: readonly App[]): DashboardSummary {
  const byStatus: Record<AppStatus, number> = {
    online: 0,
    offline: 0,
    maintenance: 0,
  };
  let hidden = 0;
  let withoutUrl = 0;
  for (const app of apps) {
    byStatus[app.status] += 1;
    if (app.isHidden) hidden += 1;
    if (!app.url) withoutUrl += 1;
  }
  return {
    total: apps.length,
    visible: apps.length - hidden,
    hidden,
    byStatus,
    withoutUrl,
  };
}
