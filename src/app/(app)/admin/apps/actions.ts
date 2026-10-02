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
import { recordAppEvent } from "@/lib/admin/apps/audit";
import {
  parseAppForm,
  parseStatusForm,
  readAppForm,
} from "@/lib/admin/apps/form";
import { statusLabel } from "@/lib/catalogue/status";
import { sortApps } from "@/lib/catalogue/filter";
import { requireAdmin } from "@/lib/auth";
import { getAdminRepositories } from "@/lib/data";
import {
  isConflictError,
  isNotFoundError,
  isValidationError,
} from "@/lib/data/errors";
import type { App, UpdateAppInput } from "@/lib/data/types";

const idSchema = z.string().uuid();
const directionSchema = z.enum(["up", "down"]);

/** Rafraîchit l'accueil et les pages d'administration des applications. */
function revalidateApps(appId?: string): void {
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  if (appId) revalidatePath(`/admin/apps/${appId}`);
}

/** L'application a disparu entre-temps : retour à la liste avec un message clair. */
function redirectGone(): never {
  redirect("/admin/apps?notice=gone");
}

/** Traduit une erreur de repository en résultat français sans détail interne. */
function failure(error: unknown): ActionResult {
  if (isConflictError(error)) {
    return {
      ok: false,
      message: "Le formulaire contient des erreurs.",
      fieldErrors: {
        slug: "Ce slug est déjà utilisé par une autre application.",
      },
    };
  }
  if (isValidationError(error)) {
    const fieldErrors: FieldErrors = {};
    for (const issue of error.issues) {
      if (!(issue.path in fieldErrors)) fieldErrors[issue.path] = issue.message;
    }
    return {
      ok: false,
      message: "Le formulaire contient des erreurs.",
      fieldErrors,
    };
  }
  console.error("Erreur inattendue dans l'administration des applications.");
  return { ok: false, message: GENERIC_ERROR_MESSAGE };
}

function invalidForm(fieldErrors: FieldErrors): ActionResult {
  return {
    ok: false,
    message: "Le formulaire contient des erreurs.",
    fieldErrors,
  };
}

function formId(formData: FormData): string | null {
  const parsed = idSchema.safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

/**
 * Crée une application (slug généré côté formulaire, `sortOrder = max + 1`),
 * applique le statut initial, journalise `app.created` puis redirige vers sa
 * fiche. Réservée aux admins (`requireAdmin()` en premier).
 */
export async function createAppAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = parseAppForm(readAppForm(formData), "create");
  if (!parsed.ok) return invalidForm(parsed.fieldErrors);

  const repositories = getAdminRepositories();
  let app: App;
  try {
    app = await repositories.apps.create(parsed.input);
    if (parsed.status !== app.status || parsed.statusNote) {
      app = await repositories.apps.setStatus(app.id, parsed.status, {
        note: parsed.statusNote,
        changedBy: admin.id,
      });
    }
  } catch (error) {
    return failure(error);
  }

  await recordAppEvent("app.created", admin, app.id, {
    name: app.name,
    slug: app.slug,
  });
  if (parsed.status !== "offline") {
    await recordAppEvent("app.status_changed", admin, app.id, {
      from: "offline",
      to: parsed.status,
    });
  }

  revalidateApps(app.id);
  redirect(`/admin/apps/${app.id}?notice=created`);
}

/**
 * Met à jour une application : seuls les champs modifiés sont envoyés au
 * repository et journalisés (`app.updated` avec les **noms** de champs ;
 * `app.hidden`/`app.shown` si la visibilité change). Le slug est immuable.
 */
export async function updateAppAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const id = formId(formData);
  if (!id) redirectGone();

  const parsed = parseAppForm(readAppForm(formData), "update");
  if (!parsed.ok) return invalidForm(parsed.fieldErrors);

  const repositories = getAdminRepositories();
  let existing: App;
  try {
    existing = await repositories.apps.getById(id);
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }

  const patch: UpdateAppInput = {};
  const changed: string[] = [];
  for (const [key, value] of Object.entries(parsed.input) as [
    keyof UpdateAppInput,
    unknown,
  ][]) {
    if (value !== undefined && value !== existing[key as keyof App]) {
      (patch as Record<string, unknown>)[key] = value;
      changed.push(key);
    }
  }
  if (changed.length === 0) {
    return { ok: true, message: "Aucune modification à enregistrer." };
  }

  try {
    await repositories.apps.update(id, patch);
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }

  const fields = changed.filter((key) => key !== "isHidden");
  if (fields.length > 0) {
    await recordAppEvent("app.updated", admin, id, { fields });
  }
  if (patch.isHidden !== undefined) {
    await recordAppEvent(
      patch.isHidden ? "app.hidden" : "app.shown",
      admin,
      id,
    );
  }

  revalidateApps(id);
  return { ok: true, message: "Les informations ont été enregistrées." };
}

/**
 * Masque ou affiche une application sur l'accueil. Journalise `app.hidden` ou
 * `app.shown` (rien si la visibilité est déjà celle demandée).
 */
export async function setAppVisibilityAction(
  id: string,
  hidden: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (!idSchema.safeParse(id).success) redirectGone();
  const repositories = getAdminRepositories();
  try {
    const app = await repositories.apps.getById(id);
    if (app.isHidden === hidden) {
      return {
        ok: true,
        message: `« ${app.name} » est déjà ${hidden ? "masquée" : "visible"}.`,
      };
    }
    await repositories.apps.update(id, { isHidden: hidden });
    await recordAppEvent(hidden ? "app.hidden" : "app.shown", admin, id);
    revalidateApps(id);
    return {
      ok: true,
      message: hidden
        ? `« ${app.name} » est maintenant masquée de l'accueil.`
        : `« ${app.name} » est de nouveau visible sur l'accueil.`,
    };
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }
}

/**
 * Monte ou descend une application d'un rang. Le serveur relit la liste à
 * jour, échange l'app avec son voisin (sans effet aux extrémités) et appelle
 * `reorder` avec l'ordre complet : l'ordre n'est jamais calculé côté client.
 */
export async function moveAppAction(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const admin = await requireAdmin();

  if (
    !idSchema.safeParse(id).success ||
    !directionSchema.safeParse(direction).success
  ) {
    redirectGone();
  }

  const repositories = getAdminRepositories();
  let result: ActionResult | null;
  try {
    const apps = sortApps(await repositories.apps.listAll());
    const index = apps.findIndex((app) => app.id === id);
    const current = apps[index];
    if (!current) {
      result = null;
    } else {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= apps.length) {
        result = {
          ok: true,
          message: `« ${current.name} » est déjà en ${
            direction === "up" ? "première" : "dernière"
          } position.`,
        };
      } else {
        const orderedIds = apps.map((app) => app.id);
        const neighbour = orderedIds[target] as string;
        orderedIds[target] = id;
        orderedIds[index] = neighbour;
        await repositories.apps.reorder(orderedIds);

        await recordAppEvent("app.moved", admin, id, { direction });
        revalidateApps(id);
        result = {
          ok: true,
          message: `« ${current.name} » a été ${
            direction === "up" ? "montée" : "descendue"
          } (position ${target + 1} sur ${apps.length}).`,
        };
      }
    }
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }
  // Hors du try : `redirect()` lève une exception qui ne doit pas être capturée.
  if (!result) redirectGone();
  return result;
}

/**
 * Change le statut (saisi à la main, jamais bloquant) avec une note facultative
 * (≤ 300) ; `changedBy` est l'admin de la session. Un statut inchangé ne met à
 * jour que le message et ne crée aucun événement.
 */
export async function setAppStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const id = formId(formData);
  if (!id) redirectGone();
  const parsed = parseStatusForm(formData);
  if (!parsed.ok) return invalidForm(parsed.fieldErrors);

  const repositories = getAdminRepositories();
  try {
    const before = await repositories.apps.getById(id);
    const after = await repositories.apps.setStatus(id, parsed.status, {
      note: parsed.note,
      changedBy: admin.id,
    });

    const statusChanged = before.status !== after.status;
    if (statusChanged) {
      await recordAppEvent("app.status_changed", admin, id, {
        from: before.status,
        to: after.status,
      });
    } else if (before.statusMessage !== after.statusMessage) {
      await recordAppEvent("app.updated", admin, id, {
        fields: ["statusMessage"],
      });
    }

    revalidateApps(id);
    return {
      ok: true,
      message: statusChanged
        ? `Statut mis à jour : ${statusLabel(before.status)} → ${statusLabel(after.status)}.`
        : "Statut inchangé : seul le message a été mis à jour.",
    };
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }
}

/**
 * Supprime définitivement une application (journal de statut supprimé en
 * cascade). Exige la saisie du nom exact, revérifiée ici côté serveur.
 */
export async function deleteAppAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const id = formId(formData);
  if (!id) redirectGone();
  const confirmName = String(formData.get("confirmName") ?? "").trim();

  const repositories = getAdminRepositories();
  let app: App;
  try {
    app = await repositories.apps.getById(id);
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }

  if (confirmName !== app.name.trim()) {
    return invalidForm({
      confirmName:
        "Le nom saisi ne correspond pas : l'application n'a pas été supprimée.",
    });
  }

  try {
    await repositories.apps.delete(id);
  } catch (error) {
    if (isNotFoundError(error)) redirectGone();
    return failure(error);
  }

  await recordAppEvent("app.deleted", admin, id, {
    name: app.name,
    slug: app.slug,
  });
  revalidateApps();
  redirect("/admin/apps?notice=deleted");
}
