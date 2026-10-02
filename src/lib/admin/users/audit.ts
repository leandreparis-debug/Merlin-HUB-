import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { getAdminRepositories } from "@/lib/data";

/** Actions du journal d'activité émises par l'administration des utilisateurs. */
export type UserAuditAction =
  | "user.created"
  | "user.updated"
  | "user.role_changed"
  | "user.deactivated"
  | "user.reactivated"
  | "user.password_reset";

/**
 * Journalise une action d'administration d'utilisateur (jamais bloquant :
 * `ActivityLogRepository.record` capture ses erreurs). Les métadonnées ne
 * contiennent **jamais** de mot de passe, de jeton ni de secret.
 */
export async function recordUserEvent(
  action: UserAuditAction,
  admin: Pick<SessionUser, "id" | "email">,
  targetId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await getAdminRepositories().activityLog.record({
    action,
    actorId: admin.id,
    actorEmail: admin.email,
    entityType: "user",
    entityId: targetId,
    metadata,
  });
}
