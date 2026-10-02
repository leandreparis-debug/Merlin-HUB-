import Link from "next/link";

import { statusLabel } from "@/lib/catalogue/status";
import type { StatusEventRow } from "@/lib/admin/apps/view-models";

/**
 * Liste d'événements de statut : ancien → nouveau statut (en toutes lettres),
 * note, auteur, date absolue (Europe/Paris) et relative. `showApp` ajoute le
 * nom de l'app (lien vers sa fiche) pour le tableau de bord.
 */
export function StatusEventList({
  events,
  showApp,
  emptyMessage,
}: {
  events: StatusEventRow[];
  showApp: boolean;
  emptyMessage: string;
}) {
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <ol className="divide-border divide-y" data-testid="status-events">
      {events.map((event) => (
        <li key={event.id} className="space-y-1 py-3">
          <p className="text-foreground text-sm font-medium">
            {showApp ? (
              <>
                <Link
                  href={`/admin/apps/${event.appId}`}
                  className="text-primary underline underline-offset-4"
                >
                  {event.appName}
                </Link>
                {" : "}
              </>
            ) : null}
            {event.previousStatus
              ? `${statusLabel(event.previousStatus)} → ${statusLabel(event.newStatus)}`
              : statusLabel(event.newStatus)}
          </p>
          {event.note ? (
            <p className="text-foreground/80 text-sm">{event.note}</p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            <time title={event.absoluteDate}>{event.absoluteDate}</time>
            {event.relativeDate ? ` (${event.relativeDate})` : null}
            {event.author ? ` · ${event.author}` : null}
          </p>
        </li>
      ))}
    </ol>
  );
}
