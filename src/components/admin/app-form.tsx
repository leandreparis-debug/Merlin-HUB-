"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import { Field, SELECT_CLASS } from "@/components/admin/form-field";
import { IconPicker } from "@/components/admin/icon-picker";
import { AppCard } from "@/components/catalogue/app-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAppAction,
  updateAppAction,
} from "@/app/(app)/admin/apps/actions";
import type { ActionState } from "@/lib/admin/apps/action-result";
import { APP_STATUSES, type AppFormValues } from "@/lib/admin/apps/form";
import { slugify } from "@/lib/admin/apps/slugify";
import { safeEmail, safeExternalUrl } from "@/lib/catalogue/external-url";
import { statusLabel } from "@/lib/catalogue/status";
import type { AppCardModel } from "@/lib/catalogue/view-model";

/** Aperçu de la carte telle qu'elle apparaîtra sur l'accueil, d'après les valeurs saisies. */
export function previewModel(
  values: AppFormValues,
  extra: { updatedLabel: string },
): AppCardModel {
  return {
    id: "preview",
    name: values.name.trim() || "Nom de l'application",
    description: values.description.trim(),
    category: values.category.trim() || "Général",
    icon: values.icon,
    status: values.status,
    statusMessage: values.statusNote.trim() || null,
    updatedLabel: extra.updatedLabel,
    version: values.version.trim() || null,
    isNew: values.isNew,
    openUrl: safeExternalUrl(values.url),
    docUrl: safeExternalUrl(values.docUrl),
    ownerName: values.ownerName.trim() || null,
    ownerEmail: safeEmail(values.ownerEmail),
  };
}

/**
 * Formulaire de création (`mode="create"`) ou de modification (`mode="edit"`)
 * d'une application, avec aperçu en direct. Le slug est généré depuis le nom
 * à la création puis non modifiable. Les erreurs viennent du serveur (zod),
 * par champ, et le focus est replacé sur le premier champ invalide.
 */
export function AppForm({
  mode,
  initial,
  appId,
  categories,
  updatedLabel,
  statusPreview,
}: {
  mode: "create" | "edit";
  initial: AppFormValues;
  appId?: string;
  categories: string[];
  updatedLabel: string;
  /** En édition : statut actuel et message, non modifiables ici (voir panneau Statut). */
  statusPreview?: Pick<AppFormValues, "status" | "statusNote">;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === "create" ? createAppAction : updateAppAction,
    null,
  );
  const [values, setValues] = useState<AppFormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(false);
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

  function set<K extends keyof AppFormValues>(key: K, value: AppFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const preview = previewModel(
    mode === "edit" && statusPreview ? { ...values, ...statusPreview } : values,
    { updatedLabel },
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form
        ref={formRef}
        onSubmit={(event) => {
          // Pas de `action` : React réinitialiserait le formulaire (listes
          // déroulantes comprises) après chaque envoi, ce qui désynchroniserait
          // les contrôles de leur état.
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="space-y-5"
        noValidate
      >
        {appId ? <input type="hidden" name="id" value={appId} /> : null}

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
        {state?.ok ? (
          <p
            role="status"
            className="bg-status-online-bg text-status-online-text rounded-md px-4 py-3 text-sm font-medium"
          >
            {state.message}
          </p>
        ) : null}

        <Field id="name" label="Nom *" error={errors["name"]}>
          {(a11y) => (
            <Input
              {...a11y}
              name="name"
              required
              maxLength={80}
              value={values.name}
              onChange={(event) => {
                const name = event.target.value;
                setValues((current) => ({
                  ...current,
                  name,
                  slug:
                    mode === "create" && !slugTouched
                      ? slugify(name)
                      : current.slug,
                }));
              }}
            />
          )}
        </Field>

        <Field
          id="slug"
          label="Slug (identifiant technique)"
          hint={
            mode === "create"
              ? "Généré depuis le nom, modifiable maintenant. Il ne pourra plus être modifié après la création."
              : "Le slug ne peut pas être modifié après la création."
          }
          error={errors["slug"]}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name={mode === "create" ? "slug" : undefined}
              required={mode === "create"}
              maxLength={60}
              readOnly={mode === "edit"}
              value={values.slug}
              onChange={(event) => {
                setSlugTouched(true);
                set("slug", event.target.value);
              }}
            />
          )}
        </Field>

        <Field
          id="description"
          label="Description courte"
          hint="200 caractères au plus."
          error={errors["description"]}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="description"
              maxLength={200}
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
            />
          )}
        </Field>

        <IconPicker
          value={values.icon}
          onChange={(name) => set("icon", name)}
          error={errors["icon"]}
        />

        <Field
          id="category"
          label="Catégorie *"
          hint="Saisie libre ; des catégories existantes sont suggérées."
          error={errors["category"]}
        >
          {(a11y) => (
            <>
              <Input
                {...a11y}
                name="category"
                required
                maxLength={40}
                list="category-suggestions"
                value={values.category}
                onChange={(event) => set("category", event.target.value)}
              />
              <datalist id="category-suggestions">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </>
          )}
        </Field>

        <Field
          id="url"
          label="URL de l'application"
          hint="Facultative (http:// ou https://). Sans URL, l'application s'affiche « Bientôt disponible »."
          error={errors["url"]}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="url"
              type="url"
              maxLength={500}
              value={values.url}
              onChange={(event) => set("url", event.target.value)}
            />
          )}
        </Field>

        <Field id="version" label="Version" error={errors["version"]}>
          {(a11y) => (
            <Input
              {...a11y}
              name="version"
              maxLength={30}
              value={values.version}
              onChange={(event) => set("version", event.target.value)}
            />
          )}
        </Field>

        <div className="flex min-h-11 items-center gap-3">
          <input
            id="isNew"
            name="isNew"
            type="checkbox"
            checked={values.isNew}
            onChange={(event) => set("isNew", event.target.checked)}
            className="accent-primary size-5"
          />
          <label htmlFor="isNew" className="text-sm font-medium">
            Afficher le badge « Nouveau »
          </label>
        </div>

        <Field id="ownerName" label="Responsable" error={errors["ownerName"]}>
          {(a11y) => (
            <Input
              {...a11y}
              name="ownerName"
              maxLength={80}
              value={values.ownerName}
              onChange={(event) => set("ownerName", event.target.value)}
            />
          )}
        </Field>

        <Field
          id="ownerEmail"
          label="Email du responsable"
          error={errors["ownerEmail"]}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="ownerEmail"
              type="email"
              maxLength={254}
              value={values.ownerEmail}
              onChange={(event) => set("ownerEmail", event.target.value)}
            />
          )}
        </Field>

        <Field
          id="docUrl"
          label="Lien de documentation"
          hint="Facultatif (http:// ou https://)."
          error={errors["docUrl"]}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="docUrl"
              type="url"
              maxLength={500}
              value={values.docUrl}
              onChange={(event) => set("docUrl", event.target.value)}
            />
          )}
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm leading-none font-medium">
            Visibilité
          </legend>
          <div className="flex flex-wrap gap-4">
            {(
              [
                ["visible", "Visible"],
                ["hidden", "Masquée"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="visibility"
                  value={value}
                  checked={values.visibility === value}
                  onChange={() => set("visibility", value)}
                  className="accent-primary size-5"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            Une application masquée n&apos;apparaît jamais sur l&apos;accueil.
          </p>
        </fieldset>

        {mode === "create" ? (
          <>
            <Field
              id="status"
              label="Statut initial"
              hint="Saisi à la main ; il n'empêche jamais d'ouvrir l'application."
              error={errors["status"]}
            >
              {(a11y) => (
                <select
                  {...a11y}
                  name="status"
                  className={SELECT_CLASS}
                  value={values.status}
                  onChange={(event) =>
                    set("status", event.target.value as AppFormValues["status"])
                  }
                >
                  {APP_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field
              id="statusNote"
              label="Message de statut (facultatif)"
              hint="300 caractères au plus ; affiché sur la carte."
              error={errors["statusNote"]}
            >
              {(a11y) => (
                <Input
                  {...a11y}
                  name="statusNote"
                  maxLength={300}
                  value={values.statusNote}
                  onChange={(event) => set("statusNote", event.target.value)}
                />
              )}
            </Field>
          </>
        ) : null}

        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending
            ? "Enregistrement…"
            : mode === "create"
              ? "Créer l'application"
              : "Enregistrer les modifications"}
        </Button>
      </form>

      <aside aria-labelledby="preview-title" className="space-y-3">
        <h2 id="preview-title" className="text-foreground font-semibold">
          Aperçu sur l&apos;accueil
        </h2>
        <p className="text-muted-foreground text-xs">
          Aperçu non cliquable : les liens sont désactivés.
        </p>
        <div inert data-testid="app-preview">
          <AppCard app={preview} />
        </div>
      </aside>
    </div>
  );
}
