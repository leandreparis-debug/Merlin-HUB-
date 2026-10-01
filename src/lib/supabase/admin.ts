import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "@/lib/env";

/**
 * Client Supabase avec la clé service role : contourne la RLS. Réservé au
 * code serveur, et uniquement après vérification explicite des droits
 * (rôle admin) dans le code applicatif appelant — ce client ne doit jamais
 * répondre directement à une requête utilisateur sans ce contrôle préalable.
 */
export function createAdminClient(): SupabaseClient {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis pour créer le client Supabase admin.",
    );
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
