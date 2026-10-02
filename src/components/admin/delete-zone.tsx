"use client";

import { useActionState, useState } from "react";

import { Field } from "@/components/admin/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAppAction } from "@/app/(app)/admin/apps/actions";
import type { ActionState } from "@/lib/admin/apps/action-result";

/**
 * Zone dangereuse : suppression irréversible (le journal de statut est
 * supprimé avec l'application), confirmée par la saisie du nom exact. Le
 * bouton reste désactivé tant que le nom ne correspond pas ; le serveur le
 * revérifie.
 */
export function DeleteZone({
  appId,
  appName,
}: {
  appId: string;
  appName: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteAppAction,
    null,
  );
  const [confirmName, setConfirmName] = useState("");
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const matches = confirmName.trim() === appName.trim();

  return (
    <details
      open={Boolean(state && !state.ok)}
      className="border-destructive rounded-lg border p-4"
    >
      <summary className="text-destructive focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center rounded-md font-medium outline-none focus-visible:ring-[3px]">
        Supprimer cette application
      </summary>
      <form action={formAction} className="mt-4 max-w-xl space-y-4" noValidate>
        <input type="hidden" name="id" value={appId} />
        <p className="text-sm">
          Cette action est <strong>irréversible</strong> : l&apos;application et
          son journal des changements de statut seront définitivement supprimés.
          Pour la retirer seulement de l&apos;accueil, utilisez plutôt « Masquer
          ».
        </p>
        {state && !state.ok && !errors["confirmName"] ? (
          <p role="alert" className="text-destructive text-sm font-medium">
            {state.message}
          </p>
        ) : null}
        <Field
          id="confirmName"
          label={`Saisissez le nom exact de l'application (« ${appName} ») pour confirmer`}
          error={errors["confirmName"]}
        >
          {(a11y) => (
            <Input
              {...a11y}
              name="confirmName"
              autoComplete="off"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="destructive"
          className="min-h-11"
          disabled={!matches || pending}
        >
          {pending ? "Suppression…" : "Supprimer définitivement"}
        </Button>
      </form>
    </details>
  );
}
