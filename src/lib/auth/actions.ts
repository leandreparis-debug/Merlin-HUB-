"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { FormState } from "@/lib/auth/action-state";
import { recordAuthEvent } from "@/lib/auth/audit";
import {
  ADMIN_PATH,
  CHANGE_PASSWORD_PATH,
  VIEW_COOKIE_NAME,
} from "@/lib/auth/constants";
import { nextCookieStore } from "@/lib/auth/cookies";
import { getAuthService } from "@/lib/auth/factory";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { loginSchema } from "@/lib/auth/schemas";
import {
  getCurrentUser,
  getRequestPath,
  requireUser,
} from "@/lib/auth/session";
import type { SignInResult } from "@/lib/auth/types";
import { getViewMode } from "@/lib/auth/view-mode";
import { getAdminRepositories } from "@/lib/data";

/** Durée minimale d'une réponse de connexion en échec (limite l'énumération par temporisation). */
const FAILURE_MIN_DELAY_MS = 300;

const GENERIC_UNEXPECTED_ERROR =
  "Une erreur est survenue. Réessayez dans quelques instants.";

async function waitForMinimumDelay(startedAt: number): Promise<void> {
  const remaining = FAILURE_MIN_DELAY_MS - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

function failureMessage(result: Extract<SignInResult, { ok: false }>): string {
  switch (result.reason) {
    case "invalid_credentials":
      return "Email ou mot de passe incorrect";
    case "disabled":
      return "Ce compte est désactivé. Contactez l'administrateur.";
    default:
      return result.message ?? GENERIC_UNEXPECTED_ERROR;
  }
}

/**
 * Connexion : valide la saisie, appelle `AuthService.signInWithPassword`,
 * met à jour `lastLoginAt`, journalise, puis redirige vers `next` (validé)
 * ou `/change-password` si le mot de passe doit être changé. Les échecs
 * renvoient un message générique (compte désactivé annoncé seulement après
 * un mot de passe correct) après un délai minimal uniforme.
 */
export async function loginAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const startedAt = Date.now();
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    await waitForMinimumDelay(startedAt);
    return { error: "Saisissez un email valide et votre mot de passe." };
  }
  const { email, password } = parsed.data;
  const next = safeRedirectPath(formData.get("next"));

  let result: SignInResult;
  try {
    result = await getAuthService().signInWithPassword(email, password);
  } catch {
    console.error("Erreur inattendue lors de la connexion.");
    result = { ok: false, reason: "unexpected" };
  }

  if (!result.ok) {
    await recordAuthEvent("auth.login_failed", {
      metadata: { email, reason: result.reason },
    });
    await waitForMinimumDelay(startedAt);
    return { error: failureMessage(result), email };
  }

  try {
    await getAdminRepositories().profiles.update(result.user.id, {
      lastLoginAt: new Date().toISOString(),
    });
  } catch {
    console.error("Échec de la mise à jour de la dernière connexion.");
  }
  await recordAuthEvent("auth.login", { actor: result.user });

  redirect(result.user.mustChangePassword ? CHANGE_PASSWORD_PATH : next);
}

/**
 * Changement de mot de passe (connexion requise, y compris en changement
 * forcé) : politique, confirmation, vérification du mot de passe actuel,
 * puis `mustChangePassword = false` et retour à l'accueil.
 */
export async function changePasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser({ allowPasswordChange: true });

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) {
    return { error: "Saisissez votre mot de passe actuel." };
  }
  const validation = validateNewPassword({
    newPassword,
    currentPassword,
    email: user.email,
  });
  if (!validation.ok) return { error: validation.error };
  if (newPassword !== confirmPassword) {
    return {
      error: "La confirmation ne correspond pas au nouveau mot de passe.",
    };
  }

  let result;
  try {
    result = await getAuthService().updatePassword(
      user.id,
      currentPassword,
      newPassword,
    );
  } catch {
    console.error("Erreur inattendue lors du changement de mot de passe.");
    return { error: GENERIC_UNEXPECTED_ERROR };
  }
  if (!result.ok) {
    return {
      error:
        result.reason === "wrong_current_password"
          ? "Le mot de passe actuel est incorrect."
          : (result.message ?? GENERIC_UNEXPECTED_ERROR),
    };
  }

  try {
    await getAdminRepositories().profiles.update(user.id, {
      mustChangePassword: false,
    });
  } catch {
    console.error("Échec de la mise à jour du statut de mot de passe.");
    return { error: GENERIC_UNEXPECTED_ERROR };
  }
  await recordAuthEvent("auth.password_changed", { actor: user });

  redirect("/?notice=password-changed");
}

/** Déconnexion : journalise, ferme la session, redirige vers `/login`. */
export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  try {
    await getAuthService().signOut();
  } catch {
    console.error("Erreur inattendue lors de la déconnexion.");
  }
  if (user) await recordAuthEvent("auth.logout", { actor: user });
  redirect("/login");
}

/**
 * Bascule vue admin ↔ vue utilisateur (cookie cosmétique). Ignorée pour un
 * non-admin. Depuis `/admin`, repasse en vue utilisateur → redirige vers `/`.
 */
export async function toggleViewModeAction(): Promise<void> {
  const user = await requireUser();
  if (user.role !== "admin") return;

  const next = (await getViewMode(user)) === "admin" ? "user" : "admin";
  await nextCookieStore().set(VIEW_COOKIE_NAME, next, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  await recordAuthEvent("auth.view_mode_changed", {
    actor: user,
    metadata: { view: next },
  });

  const path = await getRequestPath();
  if (next === "user" && path.startsWith(ADMIN_PATH)) redirect("/");
  revalidatePath("/", "layout");
}
