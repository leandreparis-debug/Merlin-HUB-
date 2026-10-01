import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getEnv } from "@/lib/env";

/**
 * Client Supabase basé sur la session de l'utilisateur courant (cookies),
 * avec la clé publique (anon) : la RLS s'applique normalement. Asynchrone
 * car `cookies()` est asynchrone depuis Next.js 15. Le câblage avec
 * l'authentification (connexion, rafraîchissement de session via
 * middleware) est fait à l'étape 3.
 */
export async function createUserClient() {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis pour créer le client Supabase utilisateur.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // setAll peut être appelée depuis un Server Component (lecture
            // seule des cookies) : sans incidence tant qu'une middleware
            // rafraîchit la session, câblée à l'étape 3.
          }
        },
      },
    },
  );
}
