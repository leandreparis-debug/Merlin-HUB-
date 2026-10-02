/** Erreurs par champ d'un formulaire d'administration (clé = nom du champ). */
export type FieldErrors = Record<string, string>;

/**
 * Résultat typé d'une action d'administration, utilisable avec
 * `useActionState`. `message` est toujours un texte français destiné à
 * l'utilisateur, sans détail interne.
 */
export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: FieldErrors };

/** État initial d'un formulaire (`useActionState`) : aucun résultat. */
export type ActionState = ActionResult | null;

/** Message générique pour toute erreur imprévue. */
export const GENERIC_ERROR_MESSAGE =
  "Une erreur est survenue. Réessayez dans quelques instants.";

/** Message quand l'application visée n'existe plus. */
export const APP_GONE_MESSAGE = "Cette application n'existe plus.";
