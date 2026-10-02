import Link from "next/link";

import { AnnouncementCard } from "@/components/announcements/announcement-card";
import type { AnnouncementCardModel } from "@/lib/announcements/view-model";

/**
 * Zone « Annonces » de l'accueil. Rien n'est rendu sans annonce ; si la
 * lecture a échoué, seul un message discret remplace la zone (le catalogue
 * reste affiché).
 */
export function AnnouncementsZone({
  items,
  hasMore,
  unavailable = false,
}: {
  items: AnnouncementCardModel[];
  hasMore: boolean;
  unavailable?: boolean;
}) {
  if (unavailable) {
    return (
      <p
        className="text-muted-foreground mt-8 text-sm"
        data-testid="announcements-unavailable"
        role="status"
      >
        Les annonces sont indisponibles pour le moment.
      </p>
    );
  }
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="announcements-heading"
      className="mt-8"
      data-testid="announcements-zone"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="announcements-heading"
          className="text-foreground text-xl font-semibold"
        >
          Annonces
        </h2>
        {hasMore ? (
          <Link
            href="/announcements"
            className="text-primary focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-sm text-sm underline underline-offset-4 outline-none focus-visible:ring-[3px]"
          >
            Toutes les annonces
          </Link>
        ) : null}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((announcement) => (
          <li key={announcement.id}>
            <AnnouncementCard announcement={announcement} />
          </li>
        ))}
      </ul>
    </section>
  );
}
