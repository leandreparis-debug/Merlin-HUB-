import Link from "next/link";

import { AnnouncementForm } from "@/components/admin/announcement-form";
import { loadPinnedCount } from "@/lib/admin/announcements/data";
import { EMPTY_ANNOUNCEMENT_FORM } from "@/lib/admin/announcements/form";
import { requireAdmin } from "@/lib/auth";

/** Création d'une annonce, avec aperçu en direct de sa carte. */
export default async function NewAnnouncementPage() {
  await requireAdmin();
  const pinnedCount = await loadPinnedCount();

  return (
    <section aria-labelledby="new-announcement-title" className="space-y-6">
      <div>
        <p className="text-sm">
          <Link
            href="/admin/announcements"
            className="text-primary underline underline-offset-4"
          >
            ← Retour à la liste
          </Link>
        </p>
        <h2
          id="new-announcement-title"
          className="text-foreground mt-2 text-xl font-semibold"
        >
          Nouvelle annonce
        </h2>
      </div>
      <AnnouncementForm
        mode="create"
        initial={EMPTY_ANNOUNCEMENT_FORM}
        pinnedCount={pinnedCount}
        previewLabel="publiée à l'instant"
      />
    </section>
  );
}
