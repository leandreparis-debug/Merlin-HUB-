"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  GENERIC_ERROR_MESSAGE,
  type ActionResult,
  type ActionState,
  type FieldErrors,
} from "@/lib/admin/apps/action-result";
import { recordAnnouncementEvent } from "@/lib/admin/announcements/audit";
import {
  parseAnnouncementContent,
  readAnnouncementForm,
} from "@/lib/admin/announcements/form";
import { PINNED_WARNING_THRESHOLD } from "@/lib/admin/announcements/view-models";
import { requireAdmin } from "@/lib/auth";
import { getAdminRepositories } from "@/lib/data";
import { isNotFoundError, isValidationError } from "@/lib/data/errors";
import type { Announcement } from "@/lib/data/types";

const idSchema = z.string().uuid();

/** Rafraîchit l'accueil, `/announcements` et les pages d'administration. */
function revalidateAnnouncements(id?: string): void {
  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath("/admin", "layout");
  if (id) revalidatePath(`/admin/announcements/${id}`);
}

/** L'annonce a disparu entre-temps : retour à la liste avec un message clair. */
function redirectGone(): never {
  redirect("/admin/announcements?notice=gone");
}

function invalidForm(fieldErrors: FieldErrors): ActionResult {
  return {
    ok: false,
    message: "Le formulaire contient des erreurs.",
    fieldErrors,
  };
}

/** Traduit une erreur de repository en résultat français sans détail interne. */
function failure(error: unknown): ActionResult {
  if (isValidationError(error)) {
    const fieldErrors: FieldErrors = {};
    for (const issue of error.issues) {
      const key = issue.path === "body" ? "text" : issue.path;
      if (!(key in fieldErrors)) fieldErrors[key] = issue.message;
    }
    return invalidForm(fieldErrors);
  }
  console.error("Erreur inattendue dans l'administration des annonces.");
  return { ok: false, message: GENERIC_ERROR_MESSAGE };
}

function formId(formData: FormData): string | null {
  const parsed = idSchema.safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

/** Avertissement non bloquant quand plus de 3 annonces épinglées sont publiées. */
function pinnedWarning(all: readonly Announcement[]): string {
  const pinned = all.filter((a) => a.isPinned && a.isPublished).length;
  return pinned > PINNED_WARNING_THRESHOLD
    ? ` Attention : ${pinned} annonces sont épinglées, seules 3 s'affichent sur l'accueil.`
    : "";
}

/**
 * Crée une annonce (texte brut), l'épingle et/ou la publie selon le
 * formulaire, journalise `announcement.created` puis redirige vers sa fiche.
 * Réservée aux admins (`requireAdmin()` en premier).
 */
export async function createAnnouncementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const values = readAnnouncementForm(formData);
  const parsed = parseAnnouncementContent(values);
  if (!parsed.ok) return invalidForm(parsed.fieldErrors);

  const repositories = getAdminRepositories();
  let announcement: Announcement;
  try {
    announcement = await repositories.announcements.create({
      title: parsed.title,
      body: parsed.body,
      isPinned: values.isPinned,
      isPublished: values.isPublished,
      createdBy: admin.id,
    });
  } catch (error) {
    return failure(error);
  }

  await recordAnnouncementEvent(
    "announcement.created",
    admin,
    announcement.id,
    {
      published: announcement.isPublished,
      pinned: announcement.isPinned,
    },
  );

  revalidateAnnouncements(announcement.id);
  redirect(`/admin/announcements/${announcement.id}?notice=created`);
}

/**
 * Modifie le titre et/ou le texte. Seuls les champs modifiés sont envoyés et
 * journalisés (`announcement.updated` avec les **noms** de champs). La date
 * de publication et l'épinglage ne changent pas.
 */
export async function updateAnnouncementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const id = formId(formData);
  if (!id) redirectGone();

  const parsed = parseAnnouncementContent(readAnnouncementForm(formData));
  if (!parsed.ok) return invalidForm(parsed.fieldErrors);

  const repositories = getAdminRepositories();
  let existing: Announcement;
  try {
    existing = await repositories.announcements.getById(id);
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }

  const patch: { title?: string; body?: string } = {};
  const fields: string[] = [];
  if (parsed.title !== existing.title) {
    patch.title = parsed.title;
    fields.push("title");
  }
  if (parsed.body !== existing.body) {
    patch.body = parsed.body;
    fields.push("text");
  }
  if (fields.length === 0) {
    return { ok: true, message: "Aucune modification à enregistrer." };
  }

  try {
    await repositories.announcements.update(id, patch);
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }

  await recordAnnouncementEvent("announcement.updated", admin, id, { fields });

  revalidateAnnouncements(id);
  return { ok: true, message: "L'annonce a été enregistrée." };
}

/**
 * Épingle ou désépingle une annonce (valeur explicite, idempotent : rien
 * n'est journalisé si l'état est déjà celui demandé). Avertit, sans bloquer,
 * au-delà de 3 annonces épinglées.
 */
export async function setAnnouncementPinnedAction(
  id: string,
  pinned: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!idSchema.safeParse(id).success) redirectGone();
  const repositories = getAdminRepositories();
  let result: ActionResult;
  try {
    const existing = await repositories.announcements.getById(id);
    if (existing.isPinned === pinned) {
      result = {
        ok: true,
        message: `« ${existing.title} » est déjà ${pinned ? "épinglée" : "non épinglée"}.`,
      };
    } else {
      await repositories.announcements.setPinned(id, pinned);
      await recordAnnouncementEvent(
        pinned ? "announcement.pinned" : "announcement.unpinned",
        admin,
        id,
      );
      const all = await repositories.announcements.listAll();
      revalidateAnnouncements(id);
      result = {
        ok: true,
        message: pinned
          ? `« ${existing.title} » est épinglée.${pinnedWarning(all)}`
          : `« ${existing.title} » n'est plus épinglée.`,
      };
    }
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }
  return result;
}

/**
 * Publie ou dépublie une annonce (valeur explicite, idempotent). La date de
 * première publication est conservée par le repository ; rien n'est
 * journalisé si l'état est déjà celui demandé.
 */
export async function setAnnouncementPublishedAction(
  id: string,
  published: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!idSchema.safeParse(id).success) redirectGone();
  const repositories = getAdminRepositories();
  let result: ActionResult;
  try {
    const existing = await repositories.announcements.getById(id);
    if (existing.isPublished === published) {
      result = {
        ok: true,
        message: `« ${existing.title} » est déjà ${published ? "publiée" : "en brouillon"}.`,
      };
    } else {
      await repositories.announcements.setPublished(id, published);
      await recordAnnouncementEvent(
        published ? "announcement.published" : "announcement.unpublished",
        admin,
        id,
      );
      revalidateAnnouncements(id);
      result = {
        ok: true,
        message: published
          ? `« ${existing.title} » est publiée.`
          : `« ${existing.title} » est dépubliée (brouillon).`,
      };
    }
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }
  return result;
}

/**
 * Supprime définitivement une annonce. Exige la case de confirmation,
 * revérifiée ici côté serveur ; journalise `announcement.deleted` (sans titre
 * ni texte).
 */
export async function deleteAnnouncementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const id = formId(formData);
  if (!id) redirectGone();

  if (formData.get("confirm") !== "yes") {
    return invalidForm({
      confirm:
        "Cochez la case de confirmation : l'annonce n'a pas été supprimée.",
    });
  }

  const repositories = getAdminRepositories();
  try {
    await repositories.announcements.delete(id);
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }

  await recordAnnouncementEvent("announcement.deleted", admin, id);

  revalidateAnnouncements();
  redirect("/admin/announcements?notice=deleted");
}
