import type {
  CreateReportInput,
  ListReportsFilter,
  Report,
  ReportEvent,
  ReportPriority,
  ReportStatus,
} from "@/lib/data/types";

/**
 * Accès aux signalements de bugs et demandes, et à leur suivi. Interface
 * posée à l'étape 2 ; les implémentations (Supabase et mémoire) sont
 * ajoutées à l'étape 8.
 */
export interface ReportRepository {
  create(input: CreateReportInput): Promise<Report>;
  /** Signalements créés par `userId`, du plus récent au plus ancien. */
  listMine(userId: string): Promise<Report[]>;
  /** Tous les signalements (vue admin), filtrables par statut, priorité et assignation. */
  listAll(filters?: ListReportsFilter): Promise<Report[]>;
  /** Lève {@link NotFoundError} si `id` est inconnu. */
  getById(id: string): Promise<Report>;
  /** Journalise un événement `status_changed`. Renseigne `resolvedAt` quand le nouveau statut est `resolved`. */
  updateStatus(
    id: string,
    status: ReportStatus,
    actorId?: string | null,
  ): Promise<Report>;
  /** Journalise un événement `priority_changed`. */
  updatePriority(
    id: string,
    priority: ReportPriority,
    actorId?: string | null,
  ): Promise<Report>;
  /** Journalise un événement `assigned`. `assignedTo = null` retire l'assignation. */
  assign(
    id: string,
    assignedTo: string | null,
    actorId?: string | null,
  ): Promise<Report>;
  /** Journalise un événement `comment`. */
  addComment(
    id: string,
    comment: string,
    actorId?: string | null,
  ): Promise<ReportEvent>;
  /** Historique des événements d'un signalement, du plus ancien au plus récent. */
  listEvents(reportId: string): Promise<ReportEvent[]>;
}
