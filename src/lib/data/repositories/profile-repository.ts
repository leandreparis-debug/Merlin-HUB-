import type { Profile, UpdateProfileInput } from "@/lib/data/types";

/**
 * Accès aux profils utilisateurs. La création d'un profil est déléguée au
 * trigger `handle_new_user` côté Supabase ; l'implémentation mémoire expose
 * en plus une méthode dédiée aux tests pour en créer un directement.
 */
export interface ProfileRepository {
  /** Lève {@link NotFoundError} si aucun profil ne correspond à `id`. */
  getById(id: string): Promise<Profile>;
  /** Recherche insensible à la casse. Lève {@link NotFoundError} si absent. */
  getByEmail(email: string): Promise<Profile>;
  /** Liste les profils actifs par défaut ; `includeInactive` inclut aussi les comptes désactivés. */
  list(options?: { includeInactive?: boolean }): Promise<Profile[]>;
  /** Applique un correctif partiel. Lève {@link NotFoundError} si `id` est inconnu. */
  update(id: string, patch: UpdateProfileInput): Promise<Profile>;
  /** Nombre de comptes administrateurs actifs (utilisé pour empêcher de retirer le dernier admin). */
  countActiveAdmins(): Promise<number>;
}
