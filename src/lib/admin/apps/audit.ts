import "server-only";

import { getAdminRepositories } from "@/lib/data";
import type { SessionUser } from "@/lib/auth/types";

/** Actions du journal d'activité émises par l'administration des applications. */
export type AppAuditAction =
  | "app.created"
  | "app.updated"
  | "app.deleted"
  | "app.hidden"
  | "app.shown"
  | "app.moved"
  | "app.status_changed";

/**
 * Journalise une action d'administration d'application (jamais bloquant :
 * `ActivityLogRepository.record` capture ses erreurs). Les métadonnées ne
 * doivent contenir ni valeur de champ ni donnée sensible.
 */
export async function recordAppEvent(
  action: AppAuditAction,
  admin: Pick<SessionUser, "id" | "email">,
  appId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await getAdminRepositories().activityLog.record({
    action,
    actorId: admin.id,
    actorEmail: admin.email,
    entityType: "app",
    entityId: appId,
    metadata,
  });
}
