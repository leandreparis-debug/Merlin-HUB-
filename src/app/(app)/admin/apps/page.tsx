import Link from "next/link";

import { AppsTable } from "@/components/admin/apps-table";
import { Button } from "@/components/ui/button";
import { LIST_NOTICES } from "@/lib/admin/apps/notices";
import { loadAdminAppRows } from "@/lib/admin/apps/data";
import { requireAdmin } from "@/lib/auth";

/** Liste d'administration de toutes les applications (masquées incluses). */
export default async function AdminAppsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  await requireAdmin();
  const { notice } = await searchParams;
  const rows = await loadAdminAppRows();
  const initialMessage =
    typeof notice === "string" ? (LIST_NOTICES[notice] ?? "") : "";

  return (
    <section aria-labelledby="apps-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="apps-title" className="text-foreground text-xl font-semibold">
          Applications
        </h2>
        <Button asChild className="min-h-11">
          <Link href="/admin/apps/new">Ajouter une application</Link>
        </Button>
      </div>
      <AppsTable rows={rows} initialMessage={initialMessage} />
    </section>
  );
}
