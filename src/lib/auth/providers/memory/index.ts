import "server-only";

import type { CookieStore } from "@/lib/auth/cookies";
import {
  MEMORY_SESSION_COOKIE_NAME,
  MEMORY_SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";
import {
  hashPassword,
  verifyPassword,
} from "@/lib/auth/providers/memory/password";
import {
  signSessionCookie,
  verifySessionCookie,
} from "@/lib/auth/providers/memory/session-cookie";
import { sessionUserFromProfile, type AuthService } from "@/lib/auth/service";
import type { SignInResult, UpdatePasswordResult } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/data/errors";
import type { MemoryProfileRepository } from "@/lib/data/providers/memory/profile-repository";
import type { Profile, Role } from "@/lib/data/types";

/** Dépendances de l'authentification mémoire (injectées pour être testable). */
export interface MemoryAuthDeps {
  /** Profils du store mémoire partagé avec les repositories. */
  profiles: MemoryProfileRepository;
  cookies: CookieStore;
  secret: string;
  /** Horloge (ms epoch), remplaçable dans les tests. */
  now?: () => number;
}

/** Compte à créer dans l'authentification mémoire. */
export interface MemoryAccountInput {
  email: string;
  password: string;
  fullName?: string | null;
  role?: Role;
  mustChangePassword?: boolean;
  isActive?: boolean;
}

/** {@link AuthService} en mémoire, avec la création de comptes réservée au dev/aux tests. */
export interface MemoryAuthService extends AuthService {
  /** Crée le profil (store partagé) et son mot de passe. Réservé au dev/aux tests. */
  addAccount(input: MemoryAccountInput): Promise<Profile>;
}

// Hash d'un mot de passe quelconque : comparé quand l'email est inconnu pour
// que la durée de réponse ne trahisse pas l'existence du compte.
const DUMMY_HASH = hashPassword("merlin-dummy-password");

/**
 * Authentification en mémoire pour le développement et les e2e : hash scrypt,
 * session = cookie signé HMAC. Ne jamais l'activer en production (garde dans
 * `getAuthService()`).
 */
export function createMemoryAuthService(
  deps: MemoryAuthDeps,
): MemoryAuthService {
  const now = deps.now ?? Date.now;
  const hashes = new Map<string, string>();

  async function findProfile(email: string): Promise<Profile | null> {
    try {
      return await deps.profiles.getByEmail(email);
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  }

  async function startSession(userId: string): Promise<void> {
    const exp = now() + MEMORY_SESSION_MAX_AGE_SECONDS * 1000;
    const value = await signSessionCookie({ uid: userId, exp }, deps.secret);
    await deps.cookies.set(MEMORY_SESSION_COOKIE_NAME, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MEMORY_SESSION_MAX_AGE_SECONDS,
    });
  }

  return {
    async addAccount(input) {
      const created = await deps.profiles.createForTests({
        id: crypto.randomUUID(),
        email: input.email,
        fullName: input.fullName ?? null,
        role: input.role ?? "user",
      });
      hashes.set(created.id, hashPassword(input.password));
      return deps.profiles.update(created.id, {
        mustChangePassword: input.mustChangePassword ?? false,
        isActive: input.isActive ?? true,
      });
    },

    async signInWithPassword(email, password): Promise<SignInResult> {
      const profile = await findProfile(email);
      const hash = profile ? hashes.get(profile.id) : undefined;
      const passwordOk = verifyPassword(password, hash ?? DUMMY_HASH);

      if (!profile || !hash || !passwordOk) {
        return { ok: false, reason: "invalid_credentials" };
      }
      if (!profile.isActive) return { ok: false, reason: "disabled" };

      await startSession(profile.id);
      return { ok: true, user: sessionUserFromProfile(profile) };
    },

    async signOut() {
      await deps.cookies.delete(MEMORY_SESSION_COOKIE_NAME);
    },

    async getAuthenticatedUserId() {
      const value = await deps.cookies.get(MEMORY_SESSION_COOKIE_NAME);
      const payload = await verifySessionCookie(value, deps.secret, now());
      return payload?.uid ?? null;
    },

    async updatePassword(
      userId,
      currentPassword,
      newPassword,
    ): Promise<UpdatePasswordResult> {
      const hash = hashes.get(userId);
      if (!hash || !verifyPassword(currentPassword, hash)) {
        return { ok: false, reason: "wrong_current_password" };
      }
      hashes.set(userId, hashPassword(newPassword));
      return { ok: true };
    },
  };
}
