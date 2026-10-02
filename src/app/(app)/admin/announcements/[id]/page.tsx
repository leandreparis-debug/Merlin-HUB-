import Link from "next/link";

import { AnnouncementDeleteZone } from "@/components/admin/announcement-delete-zone";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { AnnouncementStatePanel } from "@/components/admin/announcement-state-panel";
import { Button } from "@/components/ui/button";
import { loadAdminAnnouncementDetail } from "@/lib/admin/announcements/data";
import { ANNOUNCEMENT_DETAIL_NOTICES } from "@/lib/admin/announcements/notices";
import { requireAdmin } from "@/lib/auth";

/** Fiche d'administration d'une annonce : contenu, état de publication, suppression. */
export default async function AdminAnnouncementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { notice } = await searchParams;
  const detail = await loadAdminAnnouncementDetail(id);

  if (!detail) {
    return (
      <section className="space-y-4" aria-labelledby="not-found-title">
        <h2 id="not-found-title" className="text-xl font-semibold">
          Annonce introuvable
        </h2>
        <p className="text-muted-foreground">
          Cette annonce n&apos;existe pas ou n&apos;existe plus.
        </p>
        <Button asChild className="min-h-11">
          <Link href="/admin/announcements">Retour à la liste</Link>
        </Button>
      </section>
    );
  }

  const { announcement, pinnedCount } = detail;
  const message =
    typeof notice === "string"
      ? ANNOUNCEMENT_DETAIL_NOTICES[notice]
      : undefined;

  return (
    <div className="space-y-12">
      <div>
        <p className="text-sm">
          <Link
            href="/admin/announcements"
            className="text-primary underline underline-offset-4"
          >
            ← Retour à la liste
          </Link>
        </p>
        <h2 className="text-foreground mt-2 text-xl font-semibold [overflow-wrap:anywhere]">
          {announcement.title}
        </h2>
        {message ? (
          <p
            role="status"
            className="bg-status-online-bg text-status-online-text mt-3 rounded-md px-4 py-3 text-sm font-medium"
          >
            {message}
          </p>
        ) : null}
      </div>

      <section aria-labelledby="content-title" className="space-y-4">
        <h3 id="content-title" className="text-lg font-semibold">
          Contenu
        </h3>
        <AnnouncementForm
          mode="edit"
          announcementId={announcement.id}
          initial={{
            title: announcement.title,
            text: announcement.text,
            isPinned: announcement.isPinned,
            isPublished: announcement.isPublished,
          }}
          pinnedCount={pinnedCount}
          previewLabel={announcement.publishedLabel}
        />
      </section>

      <section aria-labelledby="state-title" className="space-y-4">
        <h3 id="state-title" className="text-lg font-semibold">
          État de publication
        </h3>
        <AnnouncementStatePanel
          announcementId={announcement.id}
          title={announcement.title}
          isPublished={announcement.isPublished}
          isPinned={announcement.isPinned}
          publishedLabel={announcement.publishedLabel}
          publishedAbsolute={announcement.publishedAbsolute}
          pinnedCount={pinnedCount}
        />
      </section>

      <section aria-labelledby="danger-title" className="space-y-4">
        <h3 id="danger-title" className="text-lg font-semibold">
          Zone dangereuse
        </h3>
        <AnnouncementDeleteZone announcementId={announcement.id} />
      </section>
    </div>
  );
}
