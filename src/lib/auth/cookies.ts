import "server-only";

import { cookies } from "next/headers";

/** Options d'un cookie posé par l'application. */
export interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  path?: string;
  maxAge?: number;
}

/** Accès minimal aux cookies de la requête courante (injectable dans les tests). */
export interface CookieStore {
  get(name: string): Promise<string | undefined>;
  set(name: string, value: string, options: CookieOptions): Promise<void>;
  delete(name: string): Promise<void>;
}

/**
 * {@link CookieStore} basé sur `cookies()` de Next.js. Les écritures sont
 * silencieusement ignorées depuis un Server Component (cookies en lecture
 * seule) ; elles ne sont effectives que dans une server action.
 */
export function nextCookieStore(): CookieStore {
  return {
    async get(name) {
      return (await cookies()).get(name)?.value;
    },
    async set(name, value, options) {
      try {
        (await cookies()).set(name, value, options);
      } catch {
        // Server Component : lecture seule.
      }
    },
    async delete(name) {
      try {
        (await cookies()).delete(name);
      } catch {
        // Server Component : lecture seule.
      }
    },
  };
}
