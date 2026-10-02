import type {
  SessionUser,
  SignInResult,
  UpdatePasswordResult,
} from "@/lib/auth/types";
import type { Profile } from "@/lib/data/types";

/**
 * Contrat du fournisseur d'authentification (V1 : Supabase Auth, dev/e2e :
 * mémoire, V2 : SSO interne). Le rôle, `isActive` et `mustChangePassword`
 * ne viennent jamais d'ici mais de la table `profiles`.
 */
export interface AuthService {
  /**
   * Vérifie email + mot de passe et ouvre la session. Un compte inconnu ou un
   * mauvais mot de passe donnent la même raison (`invalid_credentials`) ;
   * `disabled` n'est renvoyé qu'après un mot de passe correct.
   */
  signInWithPassword(email: string, password: string): Promise<SignInResult>;
  /** Ferme la session courante. */
  signOut(): Promise<void>;
  /**
   * Identifiant de l'utilisateur authentifié, **vérifié par le serveur
   * d'authentification** (jamais une simple lecture de cookie non validée),
   * ou `null`.
   */
  getAuthenticatedUserId(): Promise<string | null>;
  /** Change le mot de passe après avoir revérifié l'actuel. */
  updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<UpdatePasswordResult>;
}

/** Projette un profil actif vers un {@link SessionUser}. */
export function sessionUserFromProfile(profile: Profile): SessionUser {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    mustChangePassword: profile.mustChangePassword,
  };
}
