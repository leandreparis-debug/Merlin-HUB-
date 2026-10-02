import type { Role } from "@/lib/data/types";

/** Résultat de {@link AccountAdminService.createAccount}. */
export type CreateAccountResult =
  | { ok: true; userId: string; provisionalPassword: string }
  | {
      ok: false;
      reason: "email_exists" | "unexpected";
      /** Vrai si un échec partiel a pu laisser un compte créé que la compensation n'a pas pu supprimer. */
      maybeCreated?: boolean;
    };

/** Résultat de {@link AccountAdminService.resetPassword}. */
export type ResetPasswordResult =
  | { ok: true; provisionalPassword: string }
  | { ok: false; reason: "not_found" | "unexpected" };

/**
 * Gestion des comptes d'authentification par un administrateur (V1 : Supabase
 * Auth, dev : mémoire ; V2 : remplacé par le SSO). **À n'appeler qu'après
 * `requireAdmin()`.** Le mot de passe provisoire est généré dans le service,
 * jamais fourni par l'appelant, et n'est ni stocké ni journalisé.
 */
export interface AccountAdminService {
  /**
   * Crée le compte et son profil (rôle demandé, `mustChangePassword = true`).
   * En cas d'échec partiel, tente de supprimer le compte Auth créé : le rôle
   * par défaut reste `user` tant que la dernière étape n'a pas réussi.
   */
  createAccount(input: {
    email: string;
    fullName: string | null;
    role: Role;
  }): Promise<CreateAccountResult>;
  /** Génère un nouveau mot de passe provisoire et remet `mustChangePassword` à vrai. */
  resetPassword(userId: string): Promise<ResetPasswordResult>;
  /**
   * Révocation des sessions de l'utilisateur, au mieux : ne lève jamais.
   * Retourne `true` si les sessions ont effectivement été révoquées. Quand le
   * fournisseur ne le permet pas, le blocage repose sur la relecture du profil
   * à chaque requête (`getCurrentUser()`), voir `docs/AUTH.md`.
   */
  revokeSessions(userId: string): Promise<boolean>;
}
