import type {
  ActivityLogEntry,
  ListActivityLogOptions,
  RecordActivityLogInput,
} from "@/lib/data/types";

/** Écriture et lecture du journal d'activité. */
export interface ActivityLogRepository {
  /**
   * Enregistre une entrée. Ne lève **jamais** d'erreur : en cas d'échec de
   * stockage, l'erreur est capturée et journalisée côté serveur
   * (`console.error` avec un message générique), pour ne jamais faire
   * échouer l'action applicative qui a déclenché l'enregistrement.
   */
  record(entry: RecordActivityLogInput): Promise<void>;
  /** Liste triée par date décroissante, filtrable par acteur et par action. */
  list(options?: ListActivityLogOptions): Promise<ActivityLogEntry[]>;
}
