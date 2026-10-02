"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { deleteAnnouncementAction } from "@/app/(app)/admin/announcements/actions";
import type { ActionState } from "@/lib/admin/apps/action-result";

/**
 * Zone dangereuse : suppression irréversible d'une annonce, confirmée par une
 * case à cocher. Le bouton reste désactivé tant qu'elle n'est pas cochée ; le
 * serveur revérifie la confirmation.
 */
export function AnnouncementDeleteZone({
  announcementId,
}: {
  announcementId: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteAnnouncementAction,
    null,
  );
  const [confirmed, setConfirmed] = useState(false);
  const error = state && !state.ok ? state.fieldErrors?.["confirm"] : undefined;

  return (
    <details
      open={Boolean(state && !state.ok)}
      className="border-destructive rounded-lg border p-4"
    >
      <summary className="text-destructive focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center rounded-md font-medium outline-none focus-visible:ring-[3px]">
        Supprimer cette annonce
      </summary>
      <form action={formAction} className="mt-4 max-w-xl space-y-4" noValidate>
        <input type="hidden" name="id" value={announcementId} />
        <p className="text-sm">
          Cette action est <strong>irréversible</strong>. Pour retirer
          l&apos;annonce sans la perdre, utilisez plutôt « Dépublier ».
        </p>
        {state && !state.ok && !error ? (
          <p role="alert" className="text-destructive text-sm font-medium">
            {state.message}
          </p>
        ) : null}
        <div className="flex min-h-11 items-center gap-3">
          <input
            id="confirm"
            name="confirm"
            type="checkbox"
            value="yes"
            checked={confirmed}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "confirm-error" : undefined}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="accent-primary size-5"
          />
          <label htmlFor="confirm" className="text-sm font-medium">
            Je confirme la suppression définitive de cette annonce
          </label>
        </div>
        {error ? (
          <p
            id="confirm-error"
            role="alert"
            className="text-destructive text-sm font-medium"
          >
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="destructive"
          className="min-h-11"
          disabled={!confirmed || pending}
        >
          {pending ? "Suppression…" : "Supprimer définitivement"}
        </Button>
      </form>
    </details>
  );
}
