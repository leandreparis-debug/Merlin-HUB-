import type { FieldErrors } from "@/lib/admin/apps/action-result";

export { GENERIC_ERROR_MESSAGE } from "@/lib/admin/apps/action-result";
export type { FieldErrors } from "@/lib/admin/apps/action-result";

/** Mot de passe provisoire : n'existe que dans le résultat d'une action, affiché une seule fois. */
export interface ProvisionalCredentials {
  email: string;
  password: string;
  userId: string;
}

/**
 * Résultat typé d'une action d'administration des utilisateurs (`useActionState`).
 * `provisional` n'est renvoyé que par la création et la réinitialisation,
 * jamais stocké ni journalisé.
 */
export type UserActionResult =
  | { ok: true; message: string; provisional?: ProvisionalCredentials }
  | { ok: false; message: string; fieldErrors?: FieldErrors };

/** État d'un formulaire d'utilisateur : aucun résultat avant le premier envoi. */
export type UserActionState = UserActionResult | null;

/** Message quand l'utilisateur visé n'existe plus. */
export const USER_GONE_MESSAGE = "Cet utilisateur n'existe plus.";
