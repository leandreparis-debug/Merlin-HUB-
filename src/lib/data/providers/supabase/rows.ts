/**
 * Types des lignes SQL (snake_case, écrits à la main à partir des
 * migrations) et fonctions de mapping entre ces lignes et les types de
 * domaine (camelCase, `src/lib/data/types.ts`).
 */
import type {
  ActivityLogEntry,
  Announcement,
  App,
  AppStatus,
  AppStatusEvent,
  CreateAnnouncementInput,
  CreateAppInput,
  Profile,
  RecordActivityLogInput,
  Role,
  UpdateAppInput,
  UpdateProfileInput,
} from "@/lib/data/types";

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  must_change_password: boolean;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  url: string | null;
  version: string | null;
  is_new: boolean;
  owner_name: string | null;
  owner_email: string | null;
  doc_url: string | null;
  status: AppStatus;
  status_message: string | null;
  status_updated_at: string;
  sort_order: number;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppStatusEventRow {
  id: string;
  app_id: string;
  previous_status: AppStatus | null;
  new_status: AppStatus;
  note: string | null;
  changed_by: string | null;
  changed_at: string;
}

export interface ActivityLogRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Ligne `profiles` → {@link Profile}. */
export function profileFromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    mustChangePassword: row.must_change_password,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** {@link UpdateProfileInput} → correctif partiel de ligne `profiles`. */
export function updateProfileInputToRow(
  patch: UpdateProfileInput,
): Partial<ProfileRow> {
  const row: Partial<ProfileRow> = {};
  if (patch.fullName !== undefined) row.full_name = patch.fullName;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.mustChangePassword !== undefined) {
    row.must_change_password = patch.mustChangePassword;
  }
  if (patch.lastLoginAt !== undefined) row.last_login_at = patch.lastLoginAt;
  return row;
}

/** Ligne `apps` → {@link App}. */
export function appFromRow(row: AppRow): App {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    icon: row.icon,
    category: row.category,
    url: row.url,
    version: row.version,
    isNew: row.is_new,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    docUrl: row.doc_url,
    status: row.status,
    statusMessage: row.status_message,
    statusUpdatedAt: row.status_updated_at,
    sortOrder: row.sort_order,
    isHidden: row.is_hidden,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** {@link CreateAppInput} → ligne `apps` partielle (sans `id`, `sortOrder`, dates : générés par la base). */
export function createAppInputToRow(input: CreateAppInput): Partial<AppRow> {
  const row: Partial<AppRow> = { slug: input.slug, name: input.name };
  if (input.description !== undefined) row.description = input.description;
  if (input.icon !== undefined) row.icon = input.icon;
  if (input.category !== undefined) row.category = input.category;
  if (input.url !== undefined) row.url = input.url;
  if (input.version !== undefined) row.version = input.version;
  if (input.isNew !== undefined) row.is_new = input.isNew;
  if (input.ownerName !== undefined) row.owner_name = input.ownerName;
  if (input.ownerEmail !== undefined) row.owner_email = input.ownerEmail;
  if (input.docUrl !== undefined) row.doc_url = input.docUrl;
  if (input.isHidden !== undefined) row.is_hidden = input.isHidden;
  return row;
}

/** {@link UpdateAppInput} → correctif partiel de ligne `apps`. */
export function updateAppInputToRow(patch: UpdateAppInput): Partial<AppRow> {
  const row: Partial<AppRow> = {};
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.icon !== undefined) row.icon = patch.icon;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.url !== undefined) row.url = patch.url;
  if (patch.version !== undefined) row.version = patch.version;
  if (patch.isNew !== undefined) row.is_new = patch.isNew;
  if (patch.ownerName !== undefined) row.owner_name = patch.ownerName;
  if (patch.ownerEmail !== undefined) row.owner_email = patch.ownerEmail;
  if (patch.docUrl !== undefined) row.doc_url = patch.docUrl;
  if (patch.isHidden !== undefined) row.is_hidden = patch.isHidden;
  return row;
}

/** Ligne `app_status_events` → {@link AppStatusEvent}. */
export function appStatusEventFromRow(row: AppStatusEventRow): AppStatusEvent {
  return {
    id: row.id,
    appId: row.app_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    note: row.note,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
  };
}

/** Ligne `activity_log` → {@link ActivityLogEntry}. */
export function activityLogEntryFromRow(row: ActivityLogRow): ActivityLogEntry {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

/** {@link RecordActivityLogInput} → ligne `activity_log` partielle (sans `id`, `created_at` : générés par la base). */
export function recordActivityLogInputToRow(
  entry: RecordActivityLogInput,
): Omit<ActivityLogRow, "id" | "created_at"> {
  return {
    actor_id: entry.actorId ?? null,
    actor_email: entry.actorEmail ?? null,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
  };
}

export interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Ligne `announcements` → {@link Announcement}. */
export function announcementFromRow(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    isPinned: row.is_pinned,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** {@link CreateAnnouncementInput} → ligne `announcements` partielle (`published_at` est posé par le trigger de la base). */
export function createAnnouncementInputToRow(
  input: CreateAnnouncementInput,
): Partial<AnnouncementRow> {
  const row: Partial<AnnouncementRow> = {
    title: input.title,
    body: input.body,
  };
  if (input.isPinned !== undefined) row.is_pinned = input.isPinned;
  if (input.isPublished !== undefined) row.is_published = input.isPublished;
  if (input.createdBy !== undefined) row.created_by = input.createdBy;
  return row;
}
