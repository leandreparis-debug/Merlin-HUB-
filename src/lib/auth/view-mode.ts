import "server-only";

import { nextCookieStore } from "@/lib/auth/cookies";
import { VIEW_COOKIE_NAME } from "@/lib/auth/constants";
import type { SessionUser, ViewMode } from "@/lib/auth/types";
import type { Role } from "@/lib/data/types";

/**
 * Calcule la vue effective. Un non-admin est toujours en vue utilisateur,
 * quelle que soit la valeur du cookie ; un admin est en vue admin sauf si le
 * cookie vaut `"user"`. La vue est cosmétique : elle ne donne ni ne retire
 * aucun droit (l'autorisation repose sur le rôle lu en base).
 */
export function resolveViewMode(
  role: Role,
  cookieValue: string | undefined | null,
): ViewMode {
  if (role !== "admin") return "user";
  return cookieValue === "user" ? "user" : "admin";
}

/** Vue effective de l'utilisateur, d'après le cookie `merlin_view`. */
export async function getViewMode(user: SessionUser): Promise<ViewMode> {
  return resolveViewMode(
    user.role,
    await nextCookieStore().get(VIEW_COOKIE_NAME),
  );
}

/** Vrai si l'utilisateur est admin **et** en vue admin. */
export async function isAdminView(user: SessionUser): Promise<boolean> {
  return (await getViewMode(user)) === "admin";
}
