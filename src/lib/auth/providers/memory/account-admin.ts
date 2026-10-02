import "server-only";

import type {
  AccountAdminService,
  CreateAccountResult,
  ResetPasswordResult,
} from "@/lib/auth/account-admin";
import type { MemoryAuthService } from "@/lib/auth/providers/memory";
import { generateProvisionalPassword } from "@/lib/auth/provisional-password";
import { isConflictError, isNotFoundError } from "@/lib/data/errors";
import type { MemoryProfileRepository } from "@/lib/data/providers/memory/profile-repository";

/** Dépendances de la gestion de comptes en mémoire. */
export interface MemoryAccountAdminDeps {
  auth: MemoryAuthService;
  profiles: MemoryProfileRepository;
}

/**
 * {@link AccountAdminService} en mémoire (dev/e2e) : mêmes règles et mêmes
 * erreurs que la version Supabase. Les sessions mémoire sont des cookies
 * signés sans état serveur : elles ne peuvent pas être révoquées, le blocage
 * repose sur la relecture du profil à chaque requête.
 */
export function createMemoryAccountAdminService(
  deps: MemoryAccountAdminDeps,
): AccountAdminService {
  return {
    async createAccount(input): Promise<CreateAccountResult> {
      const provisionalPassword = generateProvisionalPassword(input.email);
      try {
        const profile = await deps.auth.addAccount({
          email: input.email,
          password: provisionalPassword,
          fullName: input.fullName,
          role: input.role,
          mustChangePassword: true,
        });
        return { ok: true, userId: profile.id, provisionalPassword };
      } catch (error) {
        if (isConflictError(error))
          return { ok: false, reason: "email_exists" };
        console.error("Échec de la création d'un compte (mémoire).");
        return { ok: false, reason: "unexpected" };
      }
    },

    async resetPassword(userId): Promise<ResetPasswordResult> {
      try {
        const profile = await deps.profiles.getById(userId);
        const provisionalPassword = generateProvisionalPassword(profile.email);
        await deps.profiles.update(userId, { mustChangePassword: true });
        const changed = await deps.auth.setPassword(
          userId,
          provisionalPassword,
        );
        if (!changed) return { ok: false, reason: "not_found" };
        return { ok: true, provisionalPassword };
      } catch (error) {
        if (isNotFoundError(error)) return { ok: false, reason: "not_found" };
        console.error(
          "Échec de la réinitialisation d'un mot de passe (mémoire).",
        );
        return { ok: false, reason: "unexpected" };
      }
    },

    async revokeSessions() {
      return false;
    },
  };
}
