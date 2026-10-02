"use server";

import { revalidatePath } from "next/cache";

import {
  GENERIC_ERROR_MESSAGE,
  type UserActionResult,
  type UserActionState,
} from "@/lib/admin/users/action-result";
import { recordUserEvent } from "@/lib/admin/users/audit";
import { parseCreateUserForm } from "@/lib/admin/users/form";
import { getAccountAdminService, requireAdmin } from "@/lib/auth";
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
