import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isInvalidCredentials,
  isRateLimited,
  translateAuthError,
} from "@/lib/auth/providers/supabase/errors";
import { sessionUserFromProfile, type AuthService } from "@/lib/auth/service";
import { RATE_LIMIT_MESSAGE } from "@/lib/auth/types";
import type { Profile } from "@/lib/data/types";

/** Dépendances de l'authentification Supabase (injectées pour être testable). */
export interface SupabaseAuthDeps {
  /** Client Supabase lié à la session (cookies) de la requête courante. */
  createClient(): Promise<SupabaseClient>;
  /** Profil de l'utilisateur, `null` s'il n'existe pas. */
  loadProfile(userId: string): Promise<Profile | null>;
}

/**
 * {@link AuthService} basé sur Supabase Auth. L'identité se vérifie avec
 * `auth.getUser()` (validation par le serveur Auth), jamais avec
 * `getSession()`.
 */
export function createSupabaseAuthService(deps: SupabaseAuthDeps): AuthService {
  return {
    async signInWithPassword(email, password) {
      const client = await deps.createClient();
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user) {
        return {
          ok: false,
          ...translateAuthError(error ?? { code: "unexpected_failure" }),
        };
      }

      const profile = await deps.loadProfile(data.user.id);
      if (!profile) {
        await client.auth.signOut();
        return { ok: false, reason: "invalid_credentials" };
      }
      if (!profile.isActive) {
        await client.auth.signOut();
        return { ok: false, reason: "disabled" };
      }
      return { ok: true, user: sessionUserFromProfile(profile) };
    },

    async signOut() {
      const client = await deps.createClient();
      await client.auth.signOut();
    },

    async getAuthenticatedUserId() {
      const client = await deps.createClient();
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return data.user.id;
    },

    async updatePassword(userId, currentPassword, newPassword) {
      const client = await deps.createClient();

      const { data: current, error: getUserError } =
        await client.auth.getUser();
      if (getUserError || !current.user || current.user.id !== userId) {
        return { ok: false, reason: "unexpected" };
      }
      const email = current.user.email;
      if (!email) return { ok: false, reason: "unexpected" };

      const { error: verifyError } = await client.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        if (isInvalidCredentials(verifyError)) {
          return { ok: false, reason: "wrong_current_password" };
        }
        if (isRateLimited(verifyError)) {
          return {
            ok: false,
            reason: "unexpected",
            message: RATE_LIMIT_MESSAGE,
          };
        }
        return { ok: false, reason: "unexpected" };
      }

      const { error: updateError } = await client.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        return {
          ok: false,
          reason: "unexpected",
          ...(isRateLimited(updateError)
            ? { message: RATE_LIMIT_MESSAGE }
            : {}),
        };
      }
      return { ok: true };
    },
  };
}
