import { z } from "zod";

import type { FieldErrors } from "@/lib/admin/apps/action-result";
import type { AdminAppDetail } from "@/lib/admin/apps/view-models";
import { ICON_NAMES } from "@/lib/catalogue/icons";
import {
  createAppInputSchema,
  setAppStatusInputSchema,
  updateAppInputSchema,
} from "@/lib/data/schemas";
import type {
  AppStatus,
  CreateAppInput,
  UpdateAppInput,
} from "@/lib/data/types";

/** Statuts proposables dans l'interface. */
export const APP_STATUSES: readonly AppStatus[] = [
  "online",
  "offline",
  "maintenance",
];

/** Valeurs brutes (texte) d'un formulaire d'application. */
export interface AppFormValues {
  name: string;
  slug: string;
  description: string;
  icon: string;
  category: string;
  url: string;
  version: string;
  isNew: boolean;
  ownerName: string;
  ownerEmail: string;
  docUrl: string;
  visibility: "visible" | "hidden";
  status: AppStatus;
  statusNote: string;
}

const statusFormSchema = setAppStatusInputSchema.extend({
  status: z.enum(["online", "offline", "maintenance"], {
    message: "Statut invalide",
  }),
});

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Chaîne vide → `null` (champs optionnels de type texte). */
function nullable(value: string): string | null {
  return value.trim() === "" ? null : value;
}

/** Lit un formulaire d'application ; ne valide rien (voir `parseAppForm`). */
export function readAppForm(formData: FormData): AppFormValues {
  const visibility =
    text(formData, "visibility") === "hidden" ? "hidden" : "visible";
  const status = text(formData, "status");
  return {
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    description: text(formData, "description"),
    icon: text(formData, "icon"),
    category: text(formData, "category"),
    url: text(formData, "url"),
    version: text(formData, "version"),
    isNew: formData.get("isNew") === "on",
    ownerName: text(formData, "ownerName"),
    ownerEmail: text(formData, "ownerEmail"),
    docUrl: text(formData, "docUrl"),
    visibility,
    status: (APP_STATUSES as readonly string[]).includes(status)
      ? (status as AppStatus)
      : "offline",
    statusNote: text(formData, "statusNote"),
  };
}

/** Ajoute à `errors` les messages d'un échec zod (premier message par champ). */
export function collectZodErrors(
  error: z.ZodError,
  errors: FieldErrors,
  rename: Record<string, string> = {},
): void {
  for (const issue of error.issues) {
    const path = String(issue.path[0] ?? "form");
    const field = rename[path] ?? path;
    if (!(field in errors)) errors[field] = issue.message;
  }
}

/** Résultat de {@link parseAppForm}. */
export type ParsedAppForm<T> =
  | { ok: true; input: T; status: AppStatus; statusNote: string | null }
  | { ok: false; fieldErrors: FieldErrors };

function sharedFields(values: AppFormValues) {
  return {
    name: values.name,
    description: values.description,
    icon: values.icon,
    category: values.category,
    url: nullable(values.url),
    version: nullable(values.version),
    isNew: values.isNew,
    ownerName: nullable(values.ownerName),
    ownerEmail: nullable(values.ownerEmail),
    docUrl: nullable(values.docUrl),
    isHidden: values.visibility === "hidden",
  };
}

/**
 * Valide un formulaire d'application en composant les schémas d'écriture
 * existants (`createAppInputSchema` / `updateAppInputSchema`) ; les messages
 * sont en français, par champ. À la création, valide aussi le statut initial.
 */
export function parseAppForm(
  values: AppFormValues,
  mode: "create",
): ParsedAppForm<CreateAppInput>;
export function parseAppForm(
  values: AppFormValues,
  mode: "update",
): ParsedAppForm<UpdateAppInput>;
export function parseAppForm(
  values: AppFormValues,
  mode: "create" | "update",
): ParsedAppForm<CreateAppInput> | ParsedAppForm<UpdateAppInput> {
  const errors: FieldErrors = {};
  const candidate =
    mode === "create"
      ? { slug: values.slug, ...sharedFields(values) }
      : sharedFields(values);

  const result =
    mode === "create"
      ? createAppInputSchema.safeParse(candidate)
      : updateAppInputSchema.safeParse(candidate);
  if (!result.success) collectZodErrors(result.error, errors);

  if (!ICON_NAMES.includes(values.icon) && !("icon" in errors)) {
    errors["icon"] = "Choisissez une icône dans la liste.";
  }

  let status: AppStatus = values.status;
  let statusNote: string | null = null;
  if (mode === "create") {
    const statusResult = statusFormSchema.safeParse({
      status: values.status,
      note: nullable(values.statusNote),
    });
    if (statusResult.success) {
      status = statusResult.data.status;
      statusNote = statusResult.data.note ?? null;
    } else {
      collectZodErrors(statusResult.error, errors, { note: "statusNote" });
    }
  }

  if (!result.success || Object.keys(errors).length > 0) {
    return { ok: false, fieldErrors: errors };
  }
  return { ok: true, input: result.data, status, statusNote } as
    ParsedAppForm<CreateAppInput> | ParsedAppForm<UpdateAppInput>;
}

/** Valide le formulaire de changement de statut (statut + note ≤ 300). */
export function parseStatusForm(
  formData: FormData,
):
  | { ok: true; status: AppStatus; note: string | null }
  | { ok: false; fieldErrors: FieldErrors } {
  const result = statusFormSchema.safeParse({
    status: text(formData, "status"),
    note: nullable(text(formData, "statusNote")),
  });
  if (!result.success) {
    const errors: FieldErrors = {};
    collectZodErrors(result.error, errors, { note: "statusNote" });
    return { ok: false, fieldErrors: errors };
  }
  return {
    ok: true,
    status: result.data.status,
    note: result.data.note ?? null,
  };
}

/** Valeurs initiales d'un formulaire de création. */
export const EMPTY_APP_FORM: AppFormValues = {
  name: "",
  slug: "",
  description: "",
  icon: "app-window",
  category: "Général",
  url: "",
  version: "",
  isNew: false,
  ownerName: "",
  ownerEmail: "",
  docUrl: "",
  visibility: "visible",
  status: "offline",
  statusNote: "",
};

/** Valeurs d'un formulaire d'édition d'après la fiche (rechargée depuis la base). */
export function formValuesFromDetail(app: AdminAppDetail): AppFormValues {
  return {
    name: app.name,
    slug: app.slug,
    description: app.description,
    icon: app.icon,
    category: app.category,
    url: app.url,
    version: app.version,
    isNew: app.isNew,
    ownerName: app.ownerName,
    ownerEmail: app.ownerEmail,
    docUrl: app.docUrl,
    visibility: app.isHidden ? "hidden" : "visible",
    status: app.status,
    statusNote: app.statusMessage,
  };
}
