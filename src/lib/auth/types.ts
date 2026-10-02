import type { Role } from "@/lib/data/types";

/** Utilisateur authentifié et actif, tel que résolu depuis la table `profiles`. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  mustChangePassword: boolean;
}

/** Vue courante d'un utilisateur : purement cosmétique, ne donne aucun droit. */
export type ViewMode = "admin" | "user";

/** Cause d'un échec de connexion. */
export type SignInFailureReason =
  "invalid_credentials" | "disabled" | "unexpected";

/** Résultat de {@link AuthService.signInWithPassword}. `message` : texte utilisateur optionnel (ex. limitation de débit). */
export type SignInResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: SignInFailureReason; message?: string };

/** Résultat de {@link AuthService.updatePassword}. */
export type UpdatePasswordResult =
  | { ok: true }
  | {
      ok: false;
      reason: "wrong_current_password" | "unexpected";
      message?: string;
    };

/** Message affiché quand le fournisseur d'authentification limite le débit des tentatives. */
export const RATE_LIMIT_MESSAGE =
  "Trop de tentatives, réessayez dans quelques minutes";
