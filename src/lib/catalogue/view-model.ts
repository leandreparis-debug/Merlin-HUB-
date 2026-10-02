import { safeEmail, safeExternalUrl } from "@/lib/catalogue/external-url";
import { updatedLabel } from "@/lib/catalogue/status";
import type { App, AppStatus } from "@/lib/data/types";

/**
 * Données d'une carte d'application envoyées au navigateur : objet simple et
 * sérialisable, limité à ce qui est affiché (ni `sortOrder`, ni `isHidden`,
 * ni identifiants superflus). Les liens ont déjà été validés.
 */
export interface AppCardModel {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  status: AppStatus;
  statusMessage: string | null;
  /** Texte relatif déjà calculé côté serveur (« mis à jour il y a 2 h »). */
  updatedLabel: string;
  version: string | null;
  isNew: boolean;
  /** URL http(s) validée, ou `null` → « Bientôt disponible ». */
  openUrl: string | null;
  /** URL de documentation http(s) validée, ou `null`. */
  docUrl: string | null;
  ownerName: string | null;
  /** Email valide du responsable (pour un lien `mailto:`), ou `null`. */
  ownerEmail: string | null;
}

/** Construit le view model d'une application ; `now` est injectable pour les tests. */
export function toAppCardModel(app: App, now: Date): AppCardModel {
  return {
    id: app.id,
    name: app.name,
    description: app.description,
    category: app.category,
    icon: app.icon,
    status: app.status,
    statusMessage: app.statusMessage?.trim() || null,
    updatedLabel: updatedLabel(app.statusUpdatedAt, now),
    version: app.version?.trim() || null,
    isNew: app.isNew,
    openUrl: safeExternalUrl(app.url),
    docUrl: safeExternalUrl(app.docUrl),
    ownerName: app.ownerName?.trim() || null,
    ownerEmail: safeEmail(app.ownerEmail),
  };
}
