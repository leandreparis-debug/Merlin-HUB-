import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AccountAdminService,
  CreateAccountResult,
  ResetPasswordResult,
} from "@/lib/auth/account-admin";
import { generateProvisionalPassword } from "@/lib/auth/provisional-password";
import { isNotFoundError } from "@/lib/data/errors";
import type { ProfileRepository } from "@/lib/data/repositories/profile-repository";

/** Dépendances de la gestion de comptes Supabase (injectées pour être testable). */
export interface SupabaseAccountAdminDeps {
  /** Client Supabase **service role** (`createAdminClient()`). */
  client: SupabaseClient;
  /** Repository de profils du service role. */
  profiles: ProfileRepository;
}

/** Forme minimale d'une erreur Supabase Auth. */
interface AuthErrorLike {
  code?: string | undefined;
  status?: number | undefined;
}

const EMAIL_EXISTS_CODES = new Set(["email_exists", "user_already_exists"]);

/** Vrai pour l'erreur « email déjà enregistré » de Supabase Auth. */
export function isEmailExistsError(error: AuthErrorLike): boolean {
  return error.code !== undefined && EMAIL_EXISTS_CODES.has(error.code);
}

/** Vrai pour l'erreur « utilisateur introuvable ». */
export function isUserNotFoundError(error: AuthErrorLike): boolean {
  return error.code === "user_not_found";
}

/**
 * {@link AccountAdminService} basé sur l'API d'administration de Supabase Auth
 * (clé service role, jamais exposée au client). Aucun mot de passe n'apparaît
 * dans les logs ni dans les messages d'erreur.
 */
export function createSupabaseAccountAdminService(
  deps: SupabaseAccountAdminDeps,
): AccountAdminService {
  return {
    async createAccount(input): Promise<CreateAccountResult> {
      const provisionalPassword = generateProvisionalPassword(input.email);

      const { data, error } = await deps.client.auth.admin.createUser({
        email: input.email,
        password: provisionalPassword,
        email_confirm: true,
        user_metadata: input.fullName ? { full_name: input.fullName } : {},
      });
      if (error || !data.user) {
        if (error && isEmailExistsError(error)) {
          return { ok: false, reason: "email_exists" };
        }
        console.error("Échec de la création d'un compte Auth.");
        return { ok: false, reason: "unexpected" };
      }
      const userId = data.user.id;

      // Le trigger `handle_new_user` a créé le profil avec le rôle `user` :
      // le rôle demandé n'est appliqué qu'à la toute fin, après le reste.
      try {
        await deps.profiles.update(userId, {
          role: input.role,
          mustChangePassword: true,
        });
      } catch {
        return compensate(deps, userId);
      }
      return { ok: true, userId, provisionalPassword };
    },

    async resetPassword(userId): Promise<ResetPasswordResult> {
      try {
        const profile = await deps.profiles.getById(userId);
        const provisionalPassword = generateProvisionalPassword(profile.email);

        // Le drapeau d'abord : si le changement de mot de passe échoue ensuite,
        // l'utilisateur devra simplement en choisir un nouveau avec l'ancien.
        await deps.profiles.update(userId, { mustChangePassword: true });
        const { error } = await deps.client.auth.admin.updateUserById(userId, {
          password: provisionalPassword,
        });
        if (error) {
          if (isUserNotFoundError(error))
            return { ok: false, reason: "not_found" };
          console.error("Échec de la réinitialisation d'un mot de passe Auth.");
          return { ok: false, reason: "unexpected" };
        }
        return { ok: true, provisionalPassword };
      } catch (error) {
        if (isNotFoundError(error)) return { ok: false, reason: "not_found" };
        console.error("Échec de la réinitialisation d'un mot de passe.");
        return { ok: false, reason: "unexpected" };
      }
    },

    async revokeSessions() {
      // L'API `auth.admin.signOut(jwt, scope)` attend le JWT de la session à
      // révoquer, pas un identifiant d'utilisateur : on ne la détourne pas.
      // Le blocage repose sur la relecture du profil à chaque requête.
      return false;
    },
  };
}

/** Supprime le compte Auth créé après un échec partiel ; signale si même cela échoue. */
async function compensate(
  deps: SupabaseAccountAdminDeps,
  userId: string,
): Promise<CreateAccountResult> {
  try {
    const { error } = await deps.client.auth.admin.deleteUser(userId);
    if (!error) return { ok: false, reason: "unexpected" };
  } catch {
    // traité ci-dessous comme un échec de compensation
  }
  console.error(
    "Échec partiel de création d'un compte et de sa compensation : vérification manuelle nécessaire.",
  );
  return { ok: false, reason: "unexpected", maybeCreated: true };
}
