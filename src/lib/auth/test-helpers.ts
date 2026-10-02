import { vi } from "vitest";

/** Erreur lancée par le faux `redirect()` de Next.js dans les tests (le vrai lance aussi, pour interrompre le rendu). */
export class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`REDIRECT:${url}`);
  }
}

/** État de la requête simulée : cookies et en-têtes lus par `next/headers`. */
export function createRequestState() {
  const cookies = new Map<string, string>();
  const requestHeaders = new Map<string, string>();
  return {
    cookies,
    requestHeaders,
    /** Faux module `next/headers`. */
    nextHeaders: {
      cookies: async () => ({
        get: (name: string) => {
          const value = cookies.get(name);
          return value === undefined ? undefined : { name, value };
        },
        set: (name: string, value: string) => {
          cookies.set(name, value);
        },
        delete: (name: string) => {
          cookies.delete(name);
        },
      }),
      headers: async () => ({
        get: (name: string) => requestHeaders.get(name.toLowerCase()) ?? null,
      }),
    },
    /** Faux module `next/navigation`. */
    nextNavigation: {
      redirect: vi.fn((url: string) => {
        throw new RedirectError(url);
      }),
    },
  };
}

/** Retourne l'URL de la redirection levée par `fn`, ou `null` si aucune. */
export async function redirectTarget(
  fn: () => Promise<unknown>,
): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    if (error instanceof RedirectError) return error.url;
    throw error;
  }
}
