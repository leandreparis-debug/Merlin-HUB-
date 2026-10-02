/** Cookie de préférence de vue (admin/utilisateur) : cosmétique, ne donne aucun droit. */
export const VIEW_COOKIE_NAME = "merlin_view";

/** Cookie de session de l'implémentation mémoire (dev/e2e uniquement). */
export const MEMORY_SESSION_COOKIE_NAME = "merlin_dev_session";

/** En-tête posé par le middleware sur la requête transmise : chemin + query courants (pour `next`). */
export const REQUEST_PATH_HEADER = "x-merlin-path";

/** Durée de vie d'une session mémoire, en secondes. */
export const MEMORY_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export const LOGIN_PATH = "/login";
export const CHANGE_PASSWORD_PATH = "/change-password";
export const ADMIN_PATH = "/admin";

/**
 * Routes que le middleware redirige vers `/login` sans session (confort UX
 * uniquement). Les URL inconnues passent pour que la 404 reste publique ;
 * toute page réelle est de toute façon protégée par `requireUser()` dans le
 * layout `(app)`. À compléter quand une route de premier niveau est ajoutée.
 */
export const PROTECTED_PATH_PREFIXES = [
  CHANGE_PASSWORD_PATH,
  ADMIN_PATH,
] as const;

/** Indique si le middleware doit exiger une session pour ce chemin. */
export function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
