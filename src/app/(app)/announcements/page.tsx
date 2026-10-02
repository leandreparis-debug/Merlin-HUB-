import Link from "next/link";

import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { PageContainer } from "@/components/layout/page-container";
import { requireUser } from "@/lib/auth";
import { loadAllAnnouncements } from "@/lib/announcements/data";
import { ANNOUNCEMENTS_PAGE_CAP } from "@/lib/announcements/view-model";

/** Page « Annonces » : toutes les annonces publiées, épinglées d'abord, avec dates absolues et relatives. */
export default async function AnnouncementsPage() {
  await requireUser();
  const { items, capped } = await loadAllAnnouncements();

  return (
    <PageContainer className="py-10 sm:py-14">
      <Link
        href="/"
        className="text-primary focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-sm text-sm underline underline-offset-4 outline-none focus-visible:ring-[3px]"
      >
        ← Retour à l&apos;accueil
      </Link>
      <h1 className="text-foreground mt-2 text-3xl font-bold">Annonces</h1>

      {items.length === 0 ? (
        <p className="text-muted-foreground mt-6">
          Aucune annonce pour le moment.
        </p>
      ) : (
        <ul
          className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
          data-testid="announcements-list"
        >
          {items.map((announcement) => (
            <li key={announcement.id}>
              <AnnouncementCard announcement={announcement} showAbsoluteDate />
            </li>
          ))}
        </ul>
      )}

      {capped ? (
        <p className="text-muted-foreground mt-6 text-sm" role="note">
          Seules les {ANNOUNCEMENTS_PAGE_CAP} annonces les plus récentes sont
          affichées.
        </p>
      ) : null}
    </PageContainer>
  );
}
