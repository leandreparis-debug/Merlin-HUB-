/**
 * Traduction des erreurs Postgres/PostgREST renvoyées par Supabase vers les
 * erreurs de repository (`src/lib/data/errors.ts`), pour que le code
 * appelant n'ait jamais à connaître les codes d'erreur Postgres.
 */
import type { PostgrestError } from "@supabase/supabase-js";

import {
  ConflictError,
  NotFoundError,
  UnexpectedRepositoryError,
  ValidationError,
} from "@/lib/data/errors";

/**
 * Traduit une {@link PostgrestError} en erreur de repository :
 * `23505` (contrainte unique) → {@link ConflictError} ;
 * `PGRST116` (0 ou plusieurs lignes attendues) → {@link NotFoundError} ;
 * `23514`/`22P02` (contrainte CHECK / syntaxe invalide) → {@link ValidationError} ;
 * tout le reste → {@link UnexpectedRepositoryError}, sans divulguer le détail Postgres.
 */
export function translateSupabaseError(
  error: PostgrestError,
  entity: string,
): Error {
  switch (error.code) {
    case "23505":
      return new ConflictError(`${entity} existe déjà`);
    case "PGRST116":
      return new NotFoundError(entity);
    case "23514":
    case "22P02":
      return new ValidationError(`${entity} invalide`);
    default:
      return new UnexpectedRepositoryError(undefined, { cause: error });
  }
}
