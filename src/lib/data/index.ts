import "server-only";

import { createMemoryRepositories } from "@/lib/data/providers/memory";
import { createSupabaseRepositories } from "@/lib/data/providers/supabase";
import type { Repositories } from "@/lib/data/repositories";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserClient } from "@/lib/supabase/server";

let memorySingleton: Repositories | null = null;

/**
 * Store mémoire partagé pour tout le process (singleton), utilisé quand
 * `DATA_PROVIDER=memory`. Jamais autorisé en production : lève une erreur
 * explicite à chaque appel si `NODE_ENV=production`.
 */
function getMemoryRepositories(): Repositories {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "DATA_PROVIDER=memory ne doit jamais être utilisé en production. " +
        "Configurez un projet Supabase (voir docs/SUPABASE-SETUP.md).",
    );
  }
  memorySingleton ??= createMemoryRepositories();
  return memorySingleton;
}

/**
 * Repositories pour une requête utilisateur : client basé sur la session
 * (cookies), RLS appliquée normalement. Avec `DATA_PROVIDER=memory`,
 * retourne le store mémoire partagé du process.
 */
export async function getUserRepositories(): Promise<Repositories> {
  const env = getServerEnv();
  if (env.DATA_PROVIDER === "memory") {
    return getMemoryRepositories();
  }
  const client = await createUserClient();
  return createSupabaseRepositories(client);
}

/**
 * Repositories avec le service role : contourne la RLS. **Réservé aux
 * opérations serveur, après vérification explicite du rôle admin** dans le
 * code applicatif appelant — jamais utilisé pour répondre directement à une
 * requête utilisateur sans ce contrôle. Avec `DATA_PROVIDER=memory`,
 * retourne le même store mémoire que `getUserRepositories()`.
 */
export function getAdminRepositories(): Repositories {
  const env = getServerEnv();
  if (env.DATA_PROVIDER === "memory") {
    return getMemoryRepositories();
  }
  const client = createAdminClient();
  return createSupabaseRepositories(client);
}
