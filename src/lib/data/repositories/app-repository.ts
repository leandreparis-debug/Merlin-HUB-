import type {
  App,
  AppStatus,
  AppStatusEvent,
  CreateAppInput,
  SetAppStatusInput,
  UpdateAppInput,
} from "@/lib/data/types";

/**
 * Accès au catalogue d'applications et à son historique de statuts.
 * `setStatus` et `reorder` appellent les fonctions SQL `set_app_status` et
 * `reorder_apps` côté Supabase (transaction atomique côté base).
 */
export interface AppRepository {
  /** Applications non masquées, triées par `sortOrder`. */
  listVisible(): Promise<App[]>;
  /** Toutes les applications, y compris masquées, triées par `sortOrder`. */
  listAll(): Promise<App[]>;
  /** Lève {@link NotFoundError} si `id` est inconnu. */
  getById(id: string): Promise<App>;
  /** Lève {@link NotFoundError} si `slug` est inconnu. */
  getBySlug(slug: string): Promise<App>;
  /** Valide l'entrée, attribue `sortOrder = max + 1`. Lève {@link ConflictError} si le slug existe déjà. */
  create(input: CreateAppInput): Promise<App>;
  /** Applique un correctif partiel. Lève {@link NotFoundError} si `id` est inconnu, {@link ConflictError} si le nouveau slug existe déjà. */
  update(id: string, patch: UpdateAppInput): Promise<App>;
  /** Lève {@link NotFoundError} si `id` est inconnu. */
  delete(id: string): Promise<void>;
  /** Réattribue `sortOrder` (0, 1, 2…) selon l'ordre fourni. Atomique : lève {@link NotFoundError} si un id est inconnu, sans modification partielle. */
  reorder(orderedIds: string[]): Promise<void>;
  /** Met à jour le statut et journalise l'événement si le statut change (aucun événement si inchangé). */
  setStatus(
    id: string,
    status: AppStatus,
    options?: SetAppStatusInput,
  ): Promise<App>;
  /** Historique des statuts d'une application, du plus récent au plus ancien. */
  listStatusEvents(
    appId: string,
    options?: { limit?: number },
  ): Promise<AppStatusEvent[]>;
  /** Historique des statuts, toutes applications confondues, du plus récent au plus ancien. */
  listRecentStatusEvents(options?: {
    limit?: number;
  }): Promise<AppStatusEvent[]>;
}
