import Link from "next/link";

import { AnnouncementsTable } from "@/components/admin/announcements-table";
import { Button } from "@/components/ui/button";
import { loadAdminAnnouncementRows } from "@/lib/admin/announcements/data";
import { ANNOUNCEMENT_LIST_NOTICES } from "@/lib/admin/announcements/notices";
import { requireAdmin } from "@/lib/auth";

/** Liste d'administration des annonces (brouillons compris). */
export default async function AdminAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  await requireAdmin();
  const { notice } = await searchParams;
  const { rows, pinnedCount } = await loadAdminAnnouncementRows();
  const initialMessage =
    typeof notice === "string" ? (ANNOUNCEMENT_LIST_NOTICES[notice] ?? "") : "";

  return (
    <section aria-labelledby="announcements-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="announcements-title"
          className="text-foreground text-xl font-semibold"
        >
          Annonces
        </h2>
        <Button asChild className="min-h-11">
          <Link href="/admin/announcements/new">Nouvelle annonce</Link>
        </Button>
      </div>
      <AnnouncementsTable
        rows={rows}
        pinnedCount={pinnedCount}
        initialMessage={initialMessage}
      />
    </section>
  );
}
