"use client";

import { useActionState, useState } from "react";

import { Field, SELECT_CLASS } from "@/components/admin/form-field";
import { StatusBadge } from "@/components/catalogue/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setAppStatusAction } from "@/app/(app)/admin/apps/actions";
import type { ActionState } from "@/lib/admin/apps/action-result";
import { APP_STATUSES } from "@/lib/admin/apps/form";
import { statusLabel } from "@/lib/catalogue/status";
import type { AppStatus } from "@/lib/data/types";

/**
 * Panneau « Statut » : statut actuel, formulaire de changement (statut + note
 * ≤ 300). Choisir le statut actuel ne met à jour que le message : l'interface
 * l'indique pour éviter un faux « changement ».
 */
export function StatusPanel({
  appId,
  status,
  message,
  updatedAbsolute,
  updatedRelative,
}: {
  appId: string;
  status: AppStatus;
  message: string;
  updatedAbsolute: string;
  updatedRelative: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setAppStatusAction,
    null,
  );
  const [selected, setSelected] = useState<AppStatus>(status);
  const [note, setNote] = useState(message);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={status} />
        <span className="text-muted-foreground text-sm">
          Dernier changement : {updatedAbsolute}
          {updatedRelative ? ` (${updatedRelative})` : null}
        </span>
      </div>

      <form action={formAction} className="max-w-xl space-y-4" noValidate>
        <input type="hidden" name="id" value={appId} />

        {state && !state.ok ? (
          <p role="alert" className="text-destructive text-sm font-medium">
            {state.message}
          </p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-sm font-medium">
            {state.message}
          </p>
        ) : null}

        <Field id="new-status" label="Nouveau statut" error={errors["status"]}>
          {(a11y) => (
            <select
              {...a11y}
              name="status"
              className={SELECT_CLASS}
              value={selected}
              onChange={(event) => setSelected(event.target.value as AppStatus)}
            >
              {APP_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          )}
        </Field>

        {selected === status ? (
          <p
            data-testid="status-unchanged"
            className="bg-muted text-foreground rounded-md px-3 py-2 text-sm"
          >
            Statut inchangé : seul le message sera mis à jour.
          </p>
        ) : null}

        <Field
          id="statusNote"
          label="Note (facultative)"
          hint="300 caractères au plus ; affichée sur la carte et dans le journal."
          error={errors["statusNote"]}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="statusNote"
              maxLength={300}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>

        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Mise à jour…" : "Mettre à jour le statut"}
        </Button>
      </form>
    </div>
  );
}
