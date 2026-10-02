import "server-only";

import { nextCookieStore } from "@/lib/auth/cookies";
import {
  createMemoryAuthService,
  type MemoryAuthService,
} from "@/lib/auth/providers/memory";
import { seedDevAccounts } from "@/lib/auth/providers/memory/seed";
import { createSupabaseAuthService } from "@/lib/auth/providers/supabase";
import type { AuthService } from "@/lib/auth/service";
import { getAdminRepositories, getMemoryRepositories } from "@/lib/data";
import { NotFoundError } from "@/lib/data/errors";
import { getServerEnv } from "@/lib/env";
import { createUserClient } from "@/lib/supabase/server";

// Sur `globalThis` pour rester unique malgré les rechargements à chaud en dev.
const globalForAuth = globalThis as typeof globalThis & {
  __merlinMemoryAuth?: MemoryAuthService;
};

/**
 * Service mémoire (singleton de process, adossé au store mémoire des
 * repositories) : lève une erreur explicite en production. Les comptes de
 * dev sont créés à la première utilisation ; chaque méthode attend ce seed.
 */
function getMemoryAuthService(secret: string): AuthService {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "L'authentification en mémoire (DATA_PROVIDER=memory) ne doit jamais " +
        "être utilisée en production. Configurez Supabase (voir docs/SUPABASE-SETUP.md).",
    );
  }
  if (!globalForAuth.__merlinMemoryAuth) {
    const service = createMemoryAuthService({
      profiles: getMemoryRepositories().profiles,
      cookies: nextCookieStore(),
      secret,
    });
    const ready = seedDevAccounts(service);
    globalForAuth.__merlinMemoryAuth = {
      addAccount: async (input) => (await ready, service.addAccount(input)),
      signInWithPassword: async (...args) => (
        await ready,
        service.signInWithPassword(...args)
      ),
      signOut: async () => (await ready, service.signOut()),
      getAuthenticatedUserId: async () => (
        await ready,
        service.getAuthenticatedUserId()
      ),
      updatePassword: async (...args) => (
        await ready,
        service.updatePassword(...args)
      ),
    };
  }
  return globalForAuth.__merlinMemoryAuth;
}

/**
 * Service d'authentification choisi selon `DATA_PROVIDER` : Supabase Auth
 * (défaut) ou mémoire (dev/e2e, interdit en production). Le seul point
 * d'accès au fournisseur d'authentification pour le reste de l'application.
 */
export function getAuthService(): AuthService {
  const env = getServerEnv();
  if (env.DATA_PROVIDER === "memory") {
    return getMemoryAuthService(env.MEMORY_AUTH_SECRET ?? "");
  }
  return createSupabaseAuthService({
    createClient: createUserClient,
    // Identité tout juste vérifiée par le serveur Auth : lecture du profil
    // avec le service role (indépendante des cookies pas encore posés).
    async loadProfile(userId) {
      try {
        return await getAdminRepositories().profiles.getById(userId);
      } catch (error) {
        if (error instanceof NotFoundError) return null;
        throw error;
      }
    },
  });
}
