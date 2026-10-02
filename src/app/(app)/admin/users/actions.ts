"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  GENERIC_ERROR_MESSAGE,
  type UserActionResult,
  type UserActionState,
} from "@/lib/admin/users/action-result";
import { recordUserEvent } from "@/lib/admin/users/audit";
import {
  parseCreateUserForm,
  parseFullName,
  parseRole,
} from "@/lib/admin/users/form";
import {
  canChangeRole,
  canDeactivate,
  canReactivate,
  canResetPassword,
  type UserRuleContext,
} from "@/lib/admin/users/user-rules";
import { getAccountAdminService, requireAdmin } from "@/lib/auth";
import { getAdminRepositories } from "@/lib/data";
import { isNotFoundError } from "@/lib/data/errors";
import type { Profile } from "@/lib/data/types";
import {
  getServerEnv,
  isEmailDomainAllowed,
  parseAllowedEmailDomains,
} from "@/lib/env";

/** Rafraîchit la liste, la fiche et le tableau de bord. */
function revalidateUsers(userId?: string): void {
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  if (userId) revalidatePath(`/admin/users/${userId}`);
}

function invalidForm(fieldErrors: Record<string, string>): UserActionResult {
  return {
    ok: false,
    message: "Le formulaire contient des erreurs.",
    fieldErrors,
  };
}

/** Domaines autorisés d'après `ALLOWED_EMAIL_DOMAINS` (liste vide = aucune restriction) ; erreur de configuration → `null`. */
function allowedDomains(): string[] | null {
  try {
    return parseAllowedEmailDomains(getServerEnv().ALLOWED_EMAIL_DOMAINS);
  } catch {
    console.error("Configuration ALLOWED_EMAIL_DOMAINS invalide.");
    return null;
  }
}

const idSchema = z.string().uuid();

/** L'utilisateur a disparu entre-temps : retour à la liste avec un message clair. */
function redirectGone(): never {
  redirect("/admin/users?notice=gone");
}

function formId(formData: FormData): string | null {
  const parsed = idSchema.safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

/** Cible relue à jour et nombre d'admins actifs relu à jour (jamais des valeurs du formulaire). */
async function loadTarget(
  id: string,
  actorId: string,
): Promise<{ target: Profile; context: UserRuleContext } | null> {
  const repositories = getAdminRepositories();
  try {
    const target = await repositories.profiles.getById(id);
    const activeAdminCount = await repositories.profiles.countActiveAdmins();
    return {
      target,
      context: {
        actorId,
        target: { id: target.id, role: target.role, isActive: target.isActive },
        activeAdminCount,
      },
    };
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

function genericFailure(): UserActionResult {
  console.error("Erreur inattendue dans l'administration des utilisateurs.");
  return { ok: false, message: GENERIC_ERROR_MESSAGE };
}

/**
 * Crée un compte (email pro, nom, rôle) avec un mot de passe provisoire
 * généré côté serveur. Le mot de passe n'existe que dans le résultat de
 * l'action : jamais stocké, journalisé, ni placé dans une URL. Réservée aux
 * admins (`requireAdmin()` en premier).
 */
export async function createUserAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireAdmin();

  const parsed = parseCreateUserForm(formData);
  if (!parsed.ok) return invalidForm(parsed.fieldErrors);

  const domains = allowedDomains();
  if (domains === null) {
    return {
      ok: false,
      message:
        "La configuration des domaines autorisés est invalide : contactez l'équipe technique.",
    };
  }
  if (!isEmailDomainAllowed(parsed.email, domains)) {
    return invalidForm({
      email: `Seules les adresses des domaines suivants sont autorisées : ${domains.join(", ")}.`,
    });
  }

  const result = await getAccountAdminService().createAccount({
    email: parsed.email,
    fullName: parsed.fullName,
    role: parsed.role,
  });
  if (!result.ok) {
    if (result.reason === "email_exists") {
      return invalidForm({ email: "Un compte existe déjà avec cet email" });
    }
    return {
      ok: false,
      message: result.maybeCreated
        ? "Le compte a peut-être été créé : vérifiez la liste des utilisateurs."
        : GENERIC_ERROR_MESSAGE,
    };
  }

  await recordUserEvent("user.created", admin, result.userId, {
    email: parsed.email,
    role: parsed.role,
  });
  revalidateUsers(result.userId);

  return {
    ok: true,
    message: "Le compte a été créé.",
    provisional: {
      email: parsed.email,
      password: result.provisionalPassword,
      userId: result.userId,
    },
  };
}

/**
 * Modifie le nom complet d'un compte (l'email n'est pas modifiable : c'est
 * l'identifiant, future clé SSO). Journalise `user.updated` avec les noms de
 * champs modifiés.
 */
export async function updateUserAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireAdmin();

  const id = formId(formData);
  if (!id) redirectGone();
  const parsed = parseFullName(formData);
  if (!parsed.ok) return invalidForm(parsed.fieldErrors);

  let loaded: Awaited<ReturnType<typeof loadTarget>>;
  try {
    loaded = await loadTarget(id, admin.id);
  } catch {
    return genericFailure();
  }
  if (!loaded) redirectGone();

  if (loaded.target.fullName === parsed.fullName) {
    return { ok: true, message: "Aucune modification à enregistrer." };
  }
  try {
    await getAdminRepositories().profiles.update(id, {
      fullName: parsed.fullName,
    });
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return genericFailure();
  }

  await recordUserEvent("user.updated", admin, id, { fields: ["fullName"] });
  revalidateUsers(id);
  return { ok: true, message: "Le nom a été enregistré." };
}

/**
 * Change le rôle d'un compte. Les règles (`user-rules`) sont revérifiées côté
 * serveur avec la cible et le nombre d'admins actifs relus à jour : refus pour
 * soi-même et pour le dernier admin actif, même si le formulaire est forgé.
 */
export async function changeUserRoleAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireAdmin();

  const id = formId(formData);
  if (!id) redirectGone();
  const parsed = parseRole(formData);
  if (!parsed.ok) return invalidForm(parsed.fieldErrors);

  let loaded: Awaited<ReturnType<typeof loadTarget>>;
  try {
    loaded = await loadTarget(id, admin.id);
  } catch {
    return genericFailure();
  }
  if (!loaded) redirectGone();

  const rule = canChangeRole(loaded.context, parsed.role);
  if (!rule.allowed) return { ok: false, message: rule.reason };
  if (parsed.role === loaded.target.role) {
    return { ok: true, message: "Rôle inchangé." };
  }

  try {
    await getAdminRepositories().profiles.update(id, { role: parsed.role });
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return genericFailure();
  }

  await recordUserEvent("user.role_changed", admin, id, {
    from: loaded.target.role,
    to: parsed.role,
  });
  revalidateUsers(id);
  return {
    ok: true,
    message: `Rôle modifié : ${loaded.target.role === "admin" ? "Admin" : "Utilisateur"} → ${parsed.role === "admin" ? "Admin" : "Utilisateur"}.`,
  };
}

/**
 * Désactive ou réactive un compte (`active` = `"true"` ou `"false"`). La
 * désactivation est effective immédiatement (le profil est relu à chaque
 * requête) ; la révocation des sessions est tentée au mieux. Refus pour
 * soi-même et pour le dernier admin actif.
 */
export async function setUserActiveAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireAdmin();

  const id = formId(formData);
  if (!id) redirectGone();
  const active = formData.get("active") === "true";

  let loaded: Awaited<ReturnType<typeof loadTarget>>;
  try {
    loaded = await loadTarget(id, admin.id);
  } catch {
    return genericFailure();
  }
  if (!loaded) redirectGone();

  const rule = active ? canReactivate() : canDeactivate(loaded.context);
  if (!rule.allowed) return { ok: false, message: rule.reason };
  if (loaded.target.isActive === active) {
    return {
      ok: true,
      message: active
        ? "Le compte est déjà actif."
        : "Le compte est déjà désactivé.",
    };
  }

  try {
    await getAdminRepositories().profiles.update(id, { isActive: active });
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return genericFailure();
  }
  if (!active) {
    // Meilleur effort : ne bloque jamais la désactivation déjà effective.
    await getAccountAdminService()
      .revokeSessions(id)
      .catch(() => false);
  }

  await recordUserEvent(
    active ? "user.reactivated" : "user.deactivated",
    admin,
    id,
  );
  revalidateUsers(id);
  return {
    ok: true,
    message: active
      ? "Le compte a été réactivé."
      : "Le compte a été désactivé : son accès est bloqué immédiatement.",
  };
}

/**
 * Réinitialise le mot de passe : génère un nouveau mot de passe provisoire
 * (l'ancien cesse de fonctionner, `mustChangePassword` repasse à vrai) renvoyé
 * **uniquement** dans le résultat. Refusé pour soi-même.
 */
export async function resetUserPasswordAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const admin = await requireAdmin();

  const id = formId(formData);
  if (!id) redirectGone();

  let loaded: Awaited<ReturnType<typeof loadTarget>>;
  try {
    loaded = await loadTarget(id, admin.id);
  } catch {
    return genericFailure();
  }
  if (!loaded) redirectGone();

  const rule = canResetPassword(loaded.context);
  if (!rule.allowed) return { ok: false, message: rule.reason };

  const result = await getAccountAdminService().resetPassword(id);
  if (!result.ok) {
    if (result.reason === "not_found") redirectGone();
    return { ok: false, message: GENERIC_ERROR_MESSAGE };
  }

  await recordUserEvent("user.password_reset", admin, id);
  revalidateUsers(id);
  return {
    ok: true,
    message: "Le mot de passe a été réinitialisé.",
    provisional: {
      email: loaded.target.email,
      password: result.provisionalPassword,
      userId: id,
    },
  };
}
