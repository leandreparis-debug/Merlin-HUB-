"use client";

import { useState, useTransition } from "react";

import {
  PinnedBadge,
  PublicationBadge,
} from "@/components/admin/announcement-state-labels";
import { Button } from "@/components/ui/button";
import {
  setAnnouncementPinnedAction,
  setAnnouncementPublishedAction,
} from "@/app/(app)/admin/announcements/actions";
import { PINNED_WARNING_THRESHOLD } from "@/lib/admin/announcements/view-models";

/**
 * Panneau d'état d'une annonce : état actuel, dates, publier / dépublier et
 * épingler / désépingler (valeurs explicites). Avertit, sans bloquer, quand
 * 3 annonces ou plus sont déjà épinglées.
 */
export function AnnouncementStatePanel({
  announcementId,
  title,
  isPublished,
  isPinned,
  publishedLabel,
  publishedAbsolute,
  pinnedCount,
}: {
  announcementId: string;
  title: string;
  isPublished: boolean;
  isPinned: boolean;
  publishedLabel: string;
  publishedAbsolute: string;
  /** Nombre d'annonces épinglées publiées. */
  pinnedCount: number;
}) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<{ message: string }>) {
    startTransition(async () => {
      const result = await task();
      setMessage(result.message);
    });
  }

  const warnPin = !isPinned && pinnedCount >= PINNED_WARNING_THRESHOLD;

  return (
    <div className="space-y-4">
      <p
        role="status"
        aria-live="polite"
        data-testid="announcement-state-message"
        className="min-h-5 text-sm font-medium"
      >
        {message}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <PublicationBadge published={isPublished} />
        {isPinned ? <PinnedBadge /> : null}
      </div>
      <p className="text-muted-foreground text-sm">
        {publishedLabel}
        {publishedAbsolute ? ` (${publishedAbsolute})` : ""}
        {!isPublished
          ? " — non visible des utilisateurs tant qu'elle n'est pas publiée."
          : ""}
      </p>
      {warnPin ? (
        <p
          role="note"
          data-testid="pin-warning"
          className="bg-status-maintenance-bg text-status-maintenance-text rounded-md px-3 py-2 text-sm"
        >
          {pinnedCount} annonces sont déjà épinglées : seules 3 annonces
          épinglées s&apos;affichent sur l&apos;accueil.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          aria-label={`${isPublished ? "Dépublier" : "Publier"} ${title}`}
          onClick={() =>
            run(() =>
              setAnnouncementPublishedAction(announcementId, !isPublished),
            )
          }
        >
          {isPublished ? "Dépublier" : "Publier"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          aria-label={`${isPinned ? "Désépingler" : "Épingler"} ${title}`}
          onClick={() =>
            run(() => setAnnouncementPinnedAction(announcementId, !isPinned))
          }
        >
          {isPinned ? "Désépingler" : "Épingler"}
        </Button>
      </div>
    </div>
  );
}
