import "server-only";

import { getAdminRepositories } from "@/lib/data";
import type { SessionUser } from "@/lib/auth/types";

/** Actions du journal d'activité émises par l'administration des annonces. */
export type AnnouncementAuditAction =
  | "announcement.created"
  | "announcement.updated"
  | "announcement.published"
  | "announcement.unpublished"
  | "announcement.pinned"
  | "announcement.unpinned"
  | "announcement.deleted";

/**
 * Journalise une action sur une annonce (jamais bloquant : `record` capture
 * ses erreurs). Les métadonnées ne contiennent **jamais** le titre ni le
 * texte de l'annonce, seulement des noms de champs ou des indicateurs.
 */
export async function recordAnnouncementEvent(
  action: AnnouncementAuditAction,
  admin: Pick<SessionUser, "id" | "email">,
  announcementId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await getAdminRepositories().activityLog.record({
    action,
    actorId: admin.id,
    actorEmail: admin.email,
    entityType: "announcement",
    entityId: announcementId,
    metadata,
  });
}
