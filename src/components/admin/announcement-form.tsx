"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { Field } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
} from "@/app/(app)/admin/announcements/actions";
import type { ActionState } from "@/lib/admin/apps/action-result";
import type { AnnouncementFormValues } from "@/lib/admin/announcements/form";
import type { AnnouncementCardModel } from "@/lib/announcements/view-model";
import { PINNED_WARNING_THRESHOLD } from "@/lib/admin/announcements/view-models";

/** Limites alignées sur les schémas zod et les contraintes SQL. */
export const TITLE_MAX = 120;
export const TEXT_MAX = 2000;

/** Aperçu de la carte telle qu'elle apparaîtra aux utilisateurs, d'après les valeurs saisies. */
export function announcementPreviewModel(
  values: Pick<AnnouncementFormValues, "title" | "text" | "isPinned">,
  publishedLabel: string,
): AnnouncementCardModel {
  return {
    id: "preview",
    title: values.title.trim() || "Titre de l'annonce",
    text: values.text.trim() || "Texte de l'annonce",
    pinned: values.isPinned,
    publishedLabel,
    publishedAbsolute: "",
    publishedAt: new Date(0).toISOString(),
  };
}

/**
 * Formulaire de création (`mode="create"`, avec épinglage et publication
 * immédiate) ou de modification (`mode="edit"`, titre et texte seulement) d'une
 * annonce, avec compteur de caractères et aperçu en direct. Texte brut : rien
 * n'est interprété. Les erreurs viennent du serveur, par champ.
 */
export function AnnouncementForm({
  mode,
  initial,
  announcementId,
  pinnedCount,
  previewLabel,
}: {
  mode: "create" | "edit";
  initial: AnnouncementFormValues;
  announcementId?: string;
  /** Nombre d'annonces épinglées publiées (avertissement à l'épinglage). */
  pinnedCount: number;
  /** « publiée à l'instant » (création) ou libellé réel (édition). */
  previewLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === "create" ? createAnnouncementAction : updateAnnouncementAction,
    null,
  );
  const [values, setValues] = useState<AnnouncementFormValues>(initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Valeurs rechargées depuis la base après une modification enregistrée.
  useEffect(() => {
    setValues(initial);
  }, [initial]);

  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state && !state.ok) {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    }
  }, [state]);

  function set<K extends keyof AnnouncementFormValues>(
    key: K,
    value: AnnouncementFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const remaining = TEXT_MAX - values.text.length;
  const showPinWarning =
    mode === "create" &&
    values.isPinned &&
    values.isPublished &&
    pinnedCount >= PINNED_WARNING_THRESHOLD;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <form
        ref={formRef}
        onSubmit={(event) => {
          // Pas de `action` : React réinitialiserait le formulaire après chaque envoi.
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="space-y-5"
        noValidate
      >
        {announcementId ? (
          <input type="hidden" name="id" value={announcementId} />
        ) : null}

        {state && !state.ok ? (
          <div
            role="alert"
            className="border-destructive bg-status-offline-bg text-status-offline-text rounded-md border px-4 py-3 text-sm"
          >
            <p className="font-medium">{state.message}</p>
            {Object.keys(errors).length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {Object.values(errors).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <p
          role="status"
          aria-live="polite"
          className={
            state?.ok
              ? "bg-status-online-bg text-status-online-text rounded-md px-4 py-3 text-sm font-medium"
              : "sr-only"
          }
        >
          {state?.ok ? state.message : ""}
        </p>

        <Field
          id="title"
          label="Titre *"
          hint={`${TITLE_MAX} caractères au plus.`}
          error={errors["title"]}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="title"
              required
              maxLength={TITLE_MAX}
              value={values.title}
              onChange={(event) => set("title", event.target.value)}
            />
          )}
        </Field>

        <Field
          id="text"
          label="Texte *"
          hint="Texte brut : les retours à la ligne sont conservés, le HTML et le Markdown ne sont pas interprétés."
          error={errors["text"]}
        >
          {(a11y) => (
            <>
              <textarea
                {...a11y}
                name="text"
                required
                rows={8}
                maxLength={TEXT_MAX}
                value={values.text}
                onChange={(event) => set("text", event.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:ring-[3px] md:text-sm"
              />
              <p
                data-testid="text-counter"
                className="text-muted-foreground text-xs"
              >
                {remaining} caractère{Math.abs(remaining) > 1 ? "s" : ""}{" "}
                restant{Math.abs(remaining) > 1 ? "s" : ""} sur {TEXT_MAX}
              </p>
            </>
          )}
        </Field>

        {mode === "create" ? (
          <fieldset className="space-y-1">
            <legend className="text-sm leading-none font-medium">
              Publication
            </legend>
            <div className="flex min-h-11 items-center gap-3">
              <input
                id="isPinned"
                name="isPinned"
                type="checkbox"
                checked={values.isPinned}
                onChange={(event) => set("isPinned", event.target.checked)}
                className="accent-primary size-5"
              />
              <label htmlFor="isPinned" className="text-sm font-medium">
                Épingler
              </label>
            </div>
            <div className="flex min-h-11 items-center gap-3">
              <input
                id="isPublished"
                name="isPublished"
                type="checkbox"
                checked={values.isPublished}
                onChange={(event) => set("isPublished", event.target.checked)}
                className="accent-primary size-5"
              />
              <label htmlFor="isPublished" className="text-sm font-medium">
                Publier immédiatement
              </label>
            </div>
            <p className="text-muted-foreground text-xs">
              Sans publication, l&apos;annonce reste un brouillon visible
              uniquement des administrateurs.
            </p>
            {showPinWarning ? (
              <p
                role="status"
                data-testid="pin-warning"
                className="bg-status-maintenance-bg text-status-maintenance-text rounded-md px-3 py-2 text-sm"
              >
                {pinnedCount} annonces sont déjà épinglées : seules 3 annonces
                épinglées s&apos;affichent sur l&apos;accueil.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending
            ? "Enregistrement…"
            : mode === "create"
              ? "Créer l'annonce"
              : "Enregistrer les modifications"}
        </Button>
      </form>

      <aside aria-labelledby="announcement-preview-title" className="space-y-3">
        <h2
          id="announcement-preview-title"
          className="text-foreground font-semibold"
        >
          Aperçu pour les utilisateurs
        </h2>
        <div data-testid="announcement-preview">
          <AnnouncementCard
            announcement={announcementPreviewModel(values, previewLabel)}
          />
        </div>
      </aside>
    </div>
  );
}
