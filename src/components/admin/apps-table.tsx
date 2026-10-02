"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { AppIcon } from "@/components/catalogue/app-icon";
import { StatusBadge } from "@/components/catalogue/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  moveAppAction,
  setAppVisibilityAction,
} from "@/app/(app)/admin/apps/actions";
import type { AdminAppRow } from "@/lib/admin/apps/view-models";
import { cn } from "@/lib/utils";

/**
 * Liste d'administration : toutes les apps (masquées incluses), avec monter /
 * descendre (le serveur recalcule l'ordre), masquer / afficher et lien « Gérer ».
 * Le tableau défile dans son propre conteneur sur petit écran. Les retours
 * des actions sont annoncés dans une zone `aria-live="polite"`.
 */
export function AppsTable({
  rows,
  initialMessage = "",
}: {
  rows: AdminAppRow[];
  initialMessage?: string;
}) {
  const [message, setMessage] = useState(initialMessage);
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<{ message: string }>) {
    startTransition(async () => {
      const result = await task();
      setMessage(result.message);
    });
  }

  if (rows.length === 0) {
    return (
      <div>
        <p role="status" aria-live="polite" className="mb-4 min-h-5 text-sm">
          {message}
        </p>
        <p className="text-muted-foreground">
          Aucune application. Ajoutez la première.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p
        role="status"
        aria-live="polite"
        data-testid="admin-apps-message"
        className="text-foreground mb-4 min-h-5 text-sm font-medium"
      >
        {message}
      </p>
      <div
        role="region"
        aria-label="Liste des applications"
        tabIndex={0}
        className="border-border bg-card focus-visible:ring-ring/50 relative overflow-x-auto rounded-lg border outline-none focus-visible:ring-[3px]"
      >
        <table className="w-full min-w-[56rem] text-left text-sm">
          <caption className="sr-only">
            Applications du catalogue, triées par ordre d&apos;affichage
          </caption>
          <thead className="bg-muted text-muted-foreground text-xs uppercase">
            <tr>
              <th scope="col" className="px-3 py-3">
                Ordre
              </th>
              <th scope="col" className="px-3 py-3">
                Application
              </th>
              <th scope="col" className="px-3 py-3">
                Catégorie
              </th>
              <th scope="col" className="px-3 py-3">
                Statut
              </th>
              <th scope="col" className="px-3 py-3">
                Version
              </th>
              <th scope="col" className="px-3 py-3">
                Lien
              </th>
              <th scope="col" className="px-3 py-3">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {rows.map((row) => (
              <tr
                key={row.id}
                data-testid="admin-app-row"
                data-hidden={row.isHidden}
                className={cn(row.isHidden && "bg-muted/60")}
              >
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      disabled={pending || !row.canMoveUp}
                      aria-label={`Monter ${row.name}`}
                      onClick={() => run(() => moveAppAction(row.id, "up"))}
                    >
                      <ChevronUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      disabled={pending || !row.canMoveDown}
                      aria-label={`Descendre ${row.name}`}
                      onClick={() => run(() => moveAppAction(row.id, "down"))}
                    >
                      <ChevronDown aria-hidden="true" />
                    </Button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-md"
                    >
                      <AppIcon name={row.icon} className="size-5" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/apps/${row.id}`}
                        className="text-foreground font-medium underline-offset-4 hover:underline"
                      >
                        {row.name}
                      </Link>
                      {row.isHidden ? (
                        <Badge variant="secondary">Masquée</Badge>
                      ) : null}
                      {row.isNew ? <Badge>Nouveau</Badge> : null}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">{row.category}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={row.status} />
                    {row.statusUpdatedLabel ? (
                      <span className="text-muted-foreground text-xs">
                        {row.statusUpdatedLabel}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">{row.version ?? "—"}</td>
                <td className="px-3 py-2">
                  {row.hasUrl ? "Renseigné" : "Bientôt disponible"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={pending}
                      aria-label={`${row.isHidden ? "Afficher" : "Masquer"} ${row.name}`}
                      onClick={() =>
                        run(() => setAppVisibilityAction(row.id, !row.isHidden))
                      }
                    >
                      {row.isHidden ? "Afficher" : "Masquer"}
                    </Button>
                    <Button asChild variant="secondary" className="min-h-11">
                      <Link href={`/admin/apps/${row.id}`}>
                        Gérer
                        <span className="sr-only"> {row.name}</span>
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
