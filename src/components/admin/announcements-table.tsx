"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import {
  PinnedBadge,
  PublicationBadge,
} from "@/components/admin/announcement-state-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setAnnouncementPinnedAction,
  setAnnouncementPublishedAction,
} from "@/app/(app)/admin/announcements/actions";
import type { AdminAnnouncementRow } from "@/lib/admin/announcements/view-models";
import { PINNED_WARNING_THRESHOLD } from "@/lib/admin/announcements/view-models";
import { normalizeText } from "@/lib/catalogue/filter";

/**
 * Liste d'administration des annonces (brouillons compris) : recherche par
 * titre, épingler / désépingler, publier / dépublier (valeurs explicites, titre
 * dans l'`aria-label`) et lien « Gérer ». Les retours des actions sont annoncés
 * dans une zone `aria-live="polite"`.
 */
export function AnnouncementsTable({
  rows,
  pinnedCount,
  initialMessage = "",
}: {
  rows: AdminAnnouncementRow[];
  /** Nombre d'annonces épinglées publiées (avertissement avant d'épingler). */
  pinnedCount: number;
  initialMessage?: string;
}) {
  const [message, setMessage] = useState(initialMessage);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const visibleRows = useMemo(() => {
    const needle = normalizeText(query);
    return needle
      ? rows.filter((row) => normalizeText(row.title).includes(needle))
      : rows;
  }, [rows, query]);

  function run(task: () => Promise<{ message: string }>) {
    startTransition(async () => {
      const result = await task();
      setMessage(result.message);
    });
  }

  const live = (
    <p
      role="status"
      aria-live="polite"
      data-testid="admin-announcements-message"
      className="text-foreground mb-4 min-h-5 text-sm font-medium"
    >
      {message}
    </p>
  );

  if (rows.length === 0) {
    return (
      <div>
        {live}
        <p className="text-muted-foreground">
          Aucune annonce. Créez la première.
        </p>
      </div>
    );
  }

  return (
    <div>
      {live}
      <div className="mb-4 max-w-md space-y-2">
        <Label htmlFor="announcement-search">Rechercher par titre</Label>
        <Input
          id="announcement-search"
          type="search"
          value={query}
          maxLength={120}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {visibleRows.length === 0 ? (
        <p className="text-muted-foreground" role="status">
          Aucune annonce ne correspond à cette recherche.
        </p>
      ) : (
        <div
          role="region"
          aria-label="Liste des annonces"
          tabIndex={0}
          className="border-border bg-card focus-visible:ring-ring/50 relative overflow-x-auto rounded-lg border outline-none focus-visible:ring-[3px]"
        >
          <table className="w-full min-w-[56rem] text-left text-sm">
            <caption className="sr-only">
              Annonces, épinglées d&apos;abord puis par date de publication
            </caption>
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th scope="col" className="px-3 py-3">
                  Annonce
                </th>
                <th scope="col" className="px-3 py-3">
                  État
                </th>
                <th scope="col" className="px-3 py-3">
                  Date
                </th>
                <th scope="col" className="px-3 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  data-testid="admin-announcement-row"
                  data-published={row.isPublished}
                  data-pinned={row.isPinned}
                >
                  <td className="max-w-md px-3 py-2 [overflow-wrap:anywhere]">
                    <Link
                      href={`/admin/announcements/${row.id}`}
                      className="text-foreground font-medium underline-offset-4 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {row.excerpt}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <PublicationBadge published={row.isPublished} />
                      {row.isPinned ? <PinnedBadge /> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.dateLabel}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={pending}
                        aria-label={`${row.isPinned ? "Désépingler" : "Épingler"} ${row.title}`}
                        title={
                          !row.isPinned &&
                          pinnedCount >= PINNED_WARNING_THRESHOLD
                            ? "Plus de 3 annonces épinglées : seules 3 s'affichent sur l'accueil."
                            : undefined
                        }
                        onClick={() =>
                          run(() =>
                            setAnnouncementPinnedAction(row.id, !row.isPinned),
                          )
                        }
                      >
                        {row.isPinned ? "Désépingler" : "Épingler"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        disabled={pending}
                        aria-label={`${row.isPublished ? "Dépublier" : "Publier"} ${row.title}`}
                        onClick={() =>
                          run(() =>
                            setAnnouncementPublishedAction(
                              row.id,
                              !row.isPublished,
                            ),
                          )
                        }
                      >
                        {row.isPublished ? "Dépublier" : "Publier"}
                      </Button>
                      <Button asChild variant="secondary" className="min-h-11">
                        <Link href={`/admin/announcements/${row.id}`}>
                          Gérer
                          <span className="sr-only"> {row.title}</span>
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
