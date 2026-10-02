import "server-only";

import { getAdminRepositories } from "@/lib/data";
import type { SessionUser } from "@/lib/auth/types";

/** Actions du journal d'activité émises par l'authentification. */
export type AuthAuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.password_changed"
  | "auth.view_mode_changed";

/**
 * Journalise un événement d'authentification (écriture service role, après
 * authentification). Ne lève jamais : l'échec du journal ne doit pas bloquer
 * l'action. Ne reçoit jamais de mot de passe.
 */
export async function recordAuthEvent(
  action: AuthAuditAction,
  options: {
    actor?: Pick<SessionUser, "id" | "email">;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  try {
    await getAdminRepositories().activityLog.record({
      action,
      actorId: options.actor?.id ?? null,
      actorEmail: options.actor?.email ?? null,
      entityType: options.actor ? "profile" : null,
      entityId: options.actor?.id ?? null,
      metadata: options.metadata ?? {},
    });
  } catch {
    console.error(
      "Échec de la journalisation d'un événement d'authentification.",
    );
  }
}
