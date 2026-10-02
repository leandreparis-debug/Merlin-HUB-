import type { FieldErrors } from "@/lib/admin/apps/action-result";
import {
  announcementBodySchema,
  announcementTitleSchema,
} from "@/lib/data/schemas";

/** Valeurs brutes d'un formulaire d'annonce. */
export interface AnnouncementFormValues {
  title: string;
  text: string;
  isPinned: boolean;
  isPublished: boolean;
}

/** Valeurs initiales d'une nouvelle annonce : publiée immédiatement, non épinglée. */
export const EMPTY_ANNOUNCEMENT_FORM: AnnouncementFormValues = {
  title: "",
  text: "",
  isPinned: false,
  isPublished: true,
};

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Lit un formulaire d'annonce (cases à cocher : présentes ⇒ cochées) ; ne valide rien. */
export function readAnnouncementForm(
  formData: FormData,
): AnnouncementFormValues {
  return {
    title: text(formData, "title"),
    text: text(formData, "text"),
    isPinned: formData.has("isPinned"),
    isPublished: formData.has("isPublished"),
  };
}

export type ParsedAnnouncementForm =
  | { ok: true; title: string; body: string }
  | { ok: false; fieldErrors: FieldErrors };

/** Valide et normalise le titre et le texte (texte brut) avec les schémas partagés. */
export function parseAnnouncementContent(
  values: Pick<AnnouncementFormValues, "title" | "text">,
): ParsedAnnouncementForm {
  const title = announcementTitleSchema.safeParse(values.title);
  const body = announcementBodySchema.safeParse(values.text);
  if (title.success && body.success) {
    return { ok: true, title: title.data, body: body.data };
  }
  const fieldErrors: FieldErrors = {};
  if (!title.success) {
    fieldErrors["title"] =
      title.error.issues[0]?.message ?? "Le titre est invalide";
  }
  if (!body.success) {
    fieldErrors["text"] =
      body.error.issues[0]?.message ?? "Le texte est invalide";
  }
  return { ok: false, fieldErrors };
}
