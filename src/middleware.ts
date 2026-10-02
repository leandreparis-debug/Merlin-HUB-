import { NextResponse, type NextRequest } from "next/server";

import {
  LOGIN_PATH,
  MEMORY_SESSION_COOKIE_NAME,
  REQUEST_PATH_HEADER,
  isProtectedPath,
} from "@/lib/auth/constants";
import { verifySessionCookie } from "@/lib/auth/providers/memory/session-cookie";
import { refreshSupabaseSession } from "@/lib/auth/providers/supabase/middleware";
import { DEV_MEMORY_AUTH_SECRET } from "@/lib/env";

/**
 * Middleware : rafraîchit la session et redirige les non-connectés vers
 * `/login?next=…` (confort UX uniquement). **Aucune autorisation réelle ici** :
 * `requireUser()` / `requireAdmin()` refont tous les contrôles côté serveur
 * (layouts, pages, server actions), avec le profil lu en base.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Chemin courant transmis aux pages (pour `next`) ; écrase toute valeur
  // envoyée par le client.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_PATH_HEADER, `${pathname}${search}`);

  let response: NextResponse;
  let isAuthenticated: boolean;

  if (process.env["DATA_PROVIDER"] === "memory") {
    // Edge runtime : pas d'accès au store, on vérifie seulement la signature
    // et l'expiration du cookie.
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATA_PROVIDER=memory est interdit en production.");
    }
    const secret = process.env["MEMORY_AUTH_SECRET"] || DEV_MEMORY_AUTH_SECRET;
    const session = await verifySessionCookie(
      request.cookies.get(MEMORY_SESSION_COOKIE_NAME)?.value,
      secret,
    );
    isAuthenticated = session !== null;
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const anonKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
    if (!url || !anonKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requis " +
          "(ou DATA_PROVIDER=memory en développement).",
      );
    }
    ({ response, isAuthenticated } = await refreshSupabaseSession(
      request,
      requestHeaders,
      { url, anonKey },
    ));
  }

  if (!isAuthenticated && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = LOGIN_PATH;
    loginUrl.search = `?next=${encodeURIComponent(`${pathname}${search}`)}`;
    const redirect = NextResponse.redirect(loginUrl);
    // Conserve les cookies éventuellement rafraîchis/purgés.
    for (const cookie of response.cookies.getAll())
      redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Exclut les assets Next, robots.txt, la santé et les fichiers statiques
    // de public/ (dont brand/).
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|api/health|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)",
  ],
};
