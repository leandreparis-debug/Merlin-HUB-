const MAX_NEXT_LENGTH = 200;

/**
 * Valide le paramètre `next` de redirection après connexion : chemin relatif
 * commençant par un seul `/`, sans `//`, schéma, `\` ni caractère de contrôle,
 * de 200 caractères au plus, et jamais `/login` (boucle). Sinon `/`.
 */
export function safeRedirectPath(next: unknown): string {
  if (typeof next !== "string") return "/";
  if (next.length === 0 || next.length > MAX_NEXT_LENGTH) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.includes("\\")) return "/";
  // Les navigateurs ignorent tabulations et retours à la ligne dans une URL :
  // "/\t/evil.com" deviendrait "//evil.com".
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(next)) return "/";
  if (next === "/login" || next.startsWith("/login?")) return "/";
  return next;
}
