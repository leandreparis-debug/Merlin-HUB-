import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  CHANGE_PASSWORD_PATH,
  LOGIN_PATH,
  REQUEST_PATH_HEADER,
} from "@/lib/auth/constants";
import { getAuthService } from "@/lib/auth/factory";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { sessionUserFromProfile } from "@/lib/auth/service";
import type { SessionUser } from "@/lib/auth/types";
import { isAdminView } from "@/lib/auth/view-mode";
import { isNotFoundError } from "@/lib/data/errors";
import { getUserRepositories } from "@/lib/data";

/** Chemin + query de la requête courante (posés par le middleware), sûrs pour `next`. */
export async function getRequestPath(): Promise<string> {
  const value = (await headers()).get(REQUEST_PATH_HEADER);
  return safeRedirectPath(value);
}

/**
 * Utilisateur courant : identité vérifiée par le serveur d'authentification
 * (`getAuthenticatedUserId`) + profil lu dans `profiles` à chaque requête
 * (rôle, `isActive` et `mustChangePassword` ne viennent jamais du jeton).
 * Profil inconnu ou désactivé → `null` (et déconnexion si possible). Calculé
 * une seule fois par requête.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const auth = getAuthService();
  const userId = await auth.getAuthenticatedUserId();
  if (!userId) return null;

  try {
    const profile = await (
      await getUserRepositories()
    ).profiles.getById(userId);
    if (profile.isActive) return sessionUserFromProfile(profile);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
  }

  await auth.signOut().catch(() => undefined);
  return null;
});

/**
 * Exige un utilisateur connecté. Sinon redirige vers `/login?next=…` ; si le
 * mot de passe doit être changé, redirige vers `/change-password` sauf quand
 * `allowPasswordChange` est vrai (page de changement elle-même).
 * À appeler dans chaque layout, page et server action protégés : le
 * middleware n'est qu'un confort d'affichage.
 */
export async function requireUser(
  options: { allowPasswordChange?: boolean } = {},
): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = await getRequestPath();
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(next)}`);
  }
  if (user.mustChangePassword && !options.allowPasswordChange) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  return user;
}

/**
 * Exige un administrateur **en vue admin**. L'autorisation réelle repose sur
 * le rôle lu en base ; la vue (cookie) n'est qu'un confort d'affichage.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  if (!(await isAdminView(user))) redirect("/");
  return user;
}
