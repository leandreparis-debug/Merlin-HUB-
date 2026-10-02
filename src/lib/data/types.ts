/**
 * Types de domaine Merlin : purs, sans dépendance vers Supabase ou vers une
 * ligne SQL. Dates en chaînes ISO 8601. Les mappers (dans
 * `providers/supabase/rows.ts`) convertissent les lignes SQL (snake_case)
 * vers ces types (camelCase) et inversement.
 */

/** Rôle applicatif d'un profil. */
export type Role = "user" | "admin";

/** Statut affiché d'une application du catalogue. */
export type AppStatus = "online" | "offline" | "maintenance";

/** Type d'un signalement. */
export type ReportType = "bug" | "request";

/** Statut de traitement d'un signalement. */
export type ReportStatus = "new" | "in_progress" | "resolved";

/** Priorité d'un signalement. */
export type ReportPriority = "low" | "normal" | "high";

/** Nature d'un événement de suivi d'un signalement. */
export type ReportEventKind =
  "created" | "status_changed" | "priority_changed" | "assigned" | "comment";

/** Profil applicatif associé à un utilisateur Supabase Auth. */
export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  mustChangePassword: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Entrée de création d'un profil (réservée aux tests de l'implémentation mémoire : en Supabase, la création est déléguée au trigger `handle_new_user`). */
export interface CreateProfileInput {
  id: string;
  email: string;
  fullName?: string | null;
  role?: Role;
}

/** Correctif partiel appliqué à un profil existant. */
export interface UpdateProfileInput {
  fullName?: string | null;
  role?: Role;
  isActive?: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
}

/** Application du catalogue interne Carrefour Property. */
export interface App {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  url: string | null;
  version: string | null;
  isNew: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  docUrl: string | null;
  status: AppStatus;
  statusMessage: string | null;
  statusUpdatedAt: string;
  sortOrder: number;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Entrée de création d'une application ; `sortOrder` est toujours calculé par le repository. */
export interface CreateAppInput {
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  url?: string | null;
  version?: string | null;
  isNew?: boolean;
  ownerName?: string | null;
  ownerEmail?: string | null;
  docUrl?: string | null;
  isHidden?: boolean;
}

/** Correctif partiel appliqué à une application existante. */
export interface UpdateAppInput {
  slug?: string;
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  url?: string | null;
  version?: string | null;
  isNew?: boolean;
  ownerName?: string | null;
  ownerEmail?: string | null;
  docUrl?: string | null;
  isHidden?: boolean;
}

/** Entrée de changement de statut d'une application. */
export interface SetAppStatusInput {
  note?: string | null;
  changedBy?: string | null;
}

/** Événement d'historique de statut d'une application. */
export interface AppStatusEvent {
  id: string;
  appId: string;
  previousStatus: AppStatus | null;
  newStatus: AppStatus;
  note: string | null;
  changedBy: string | null;
  changedAt: string;
}

/** Annonce interne, épinglable, affichée sur la page d'accueil. */
export interface Announcement {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  isPublished: boolean;
  /** Date de première publication (ISO 8601), `null` tant que l'annonce n'a jamais été publiée. */
  publishedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Entrée de création d'une annonce. */
export interface CreateAnnouncementInput {
  title: string;
  body: string;
  isPinned?: boolean;
  isPublished?: boolean;
  createdBy?: string | null;
}

/** Correctif partiel appliqué à une annonce existante. */
export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  isPinned?: boolean;
  isPublished?: boolean;
}

/** Signalement de bug ou demande créé par un utilisateur. */
export interface Report {
  id: string;
  type: ReportType;
  title: string;
  description: string;
  appId: string | null;
  pageUrl: string | null;
  status: ReportStatus;
  priority: ReportPriority;
  assignedTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

/** Entrée de création d'un signalement. */
export interface CreateReportInput {
  type: ReportType;
  title: string;
  description: string;
  appId?: string | null;
  pageUrl?: string | null;
  createdBy: string;
}

/** Événement de suivi d'un signalement (changement de statut, commentaire, …). */
export interface ReportEvent {
  id: string;
  reportId: string;
  actorId: string | null;
  kind: ReportEventKind;
  fromValue: string | null;
  toValue: string | null;
  comment: string | null;
  createdAt: string;
}

/** Filtres de listing des signalements (vue admin). */
export interface ListReportsFilter {
  status?: ReportStatus;
  priority?: ReportPriority;
  assignedTo?: string | null;
}

/** Entrée d'écriture dans le journal d'activité. */
export interface RecordActivityLogInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Ligne du journal d'activité. */
export interface ActivityLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Filtres et pagination du journal d'activité. */
export interface ListActivityLogOptions {
  limit?: number;
  cursor?: string | null;
  actorId?: string;
  action?: string;
}
