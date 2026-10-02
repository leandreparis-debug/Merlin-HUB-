import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase (pattern `@supabase/ssr` pour le middleware
 * Next.js) et retourne la réponse à renvoyer, plus l'identité vérifiée par
 * `getUser()`. `requestHeaders` est transmis tel quel aux pages.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  requestHeaders: Headers,
  config: { url: string; anonKey: string },
): Promise<{ response: NextResponse; isAuthenticated: boolean }> {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(cacheHeaders ?? {})) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getUser() valide le jeton auprès du serveur Auth (et rafraîchit si besoin).
  const { data, error } = await supabase.auth.getUser();
  return { response, isAuthenticated: !error && data.user !== null };
}
