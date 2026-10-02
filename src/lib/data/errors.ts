/**
 * Erreurs de la couche de données. Communes aux deux implémentations
 * (Supabase et mémoire) pour que le code appelant n'ait jamais à
 * distinguer le fournisseur. Les messages ne divulguent aucun détail
 * interne (requête SQL, connexion, etc.).
 */
import type { ZodError } from "zod";

/** Erreur de base de la couche de données. */
export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RepositoryError";
  }
}

/** La ressource demandée n'existe pas. */
export class NotFoundError extends RepositoryError {
  constructor(entity: string, id?: string) {
    super(id ? `${entity} introuvable : ${id}` : `${entity} introuvable`);
    this.name = "NotFoundError";
  }
}

/** La ressource existe déjà (contrainte d'unicité violée, ex. slug ou email en doublon). */
export class ConflictError extends RepositoryError {
  constructor(message = "Cette ressource existe déjà") {
    super(message);
    this.name = "ConflictError";
  }
}

/** Une entrée d'écriture est invalide. */
export class ValidationError extends RepositoryError {
  readonly issues: ReadonlyArray<{ path: string; message: string }>;

  constructor(
    message: string,
    issues: ReadonlyArray<{ path: string; message: string }> = [],
  ) {
    super(message);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

/** Erreur imprévue (panne de connexion, erreur SQL non reconnue, …), avec la cause d'origine pour le débogage serveur uniquement. */
export class UnexpectedRepositoryError extends RepositoryError {
  constructor(
    message = "Une erreur inattendue est survenue",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "UnexpectedRepositoryError";
  }
}

/** Fonctionnalité dont l'implémentation est prévue à une étape ultérieure du projet. */
export class NotImplementedError extends RepositoryError {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedError";
  }
}

/** Construit une {@link ValidationError} à partir d'une erreur zod, en conservant le détail par champ. */
export function validationErrorFromZod(
  error: ZodError,
  message = "Entrée invalide",
): ValidationError {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return new ValidationError(message, issues);
}

// Contrôles par nom plutôt que `instanceof` : en développement, Next.js peut
// charger ce module en plusieurs exemplaires (couches serveur distinctes), et
// `instanceof` échouerait alors sur une erreur pourtant de la bonne classe.
function hasName(error: unknown, name: string): boolean {
  return error instanceof Error && error.name === name;
}

/** Vrai pour une {@link NotFoundError} (robuste aux doublons de module). */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError || hasName(error, "NotFoundError");
}

/** Vrai pour une {@link ConflictError} (robuste aux doublons de module). */
export function isConflictError(error: unknown): error is ConflictError {
  return error instanceof ConflictError || hasName(error, "ConflictError");
}

/** Vrai pour une {@link ValidationError} (robuste aux doublons de module). */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError || hasName(error, "ValidationError");
}
