import type { SignInFailureReason } from "@/lib/auth/types";
import { RATE_LIMIT_MESSAGE } from "@/lib/auth/types";

/** Forme minimale d'une erreur Supabase Auth (`AuthError`/`AuthApiError`). */
export interface AuthErrorLike {
  code?: string | undefined;
  status?: number | undefined;
}

/** Échec traduit : raison applicative et message utilisateur éventuel. */
export interface TranslatedAuthError {
  reason: SignInFailureReason;
  message?: string;
}

const RATE_LIMIT_CODES = new Set([
  "over_request_rate_limit",
  "over_email_send_rate_limit",
]);

/** Indique si l'erreur correspond à des identifiants invalides (mauvais email ou mot de passe). */
export function isInvalidCredentials(error: AuthErrorLike): boolean {
  return error.code === "invalid_credentials";
}

/** Indique si l'erreur correspond à une limitation de débit. */
export function isRateLimited(error: AuthErrorLike): boolean {
  return (
    (error.code !== undefined && RATE_LIMIT_CODES.has(error.code)) ||
    error.status === 429
  );
}

/**
 * Traduit une erreur Supabase Auth vers une raison applicative. Les erreurs
 * inconnues deviennent `unexpected` sans exposer aucun détail (ni code, ni
 * message du fournisseur).
 */
export function translateAuthError(error: AuthErrorLike): TranslatedAuthError {
  if (isInvalidCredentials(error)) return { reason: "invalid_credentials" };
  if (isRateLimited(error)) {
    return { reason: "unexpected", message: RATE_LIMIT_MESSAGE };
  }
  return { reason: "unexpected" };
}
