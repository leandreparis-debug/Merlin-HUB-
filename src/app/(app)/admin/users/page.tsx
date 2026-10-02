import Link from "next/link";

import { UsersTable } from "@/components/admin/users-table";
import { Button } from "@/components/ui/button";
import { loadUserRows } from "@/lib/admin/users/data";
import { parseUserListParams } from "@/lib/admin/users/filter";
import { USER_LIST_NOTICES } from "@/lib/admin/users/notices";
import { requireAdmin } from "@/lib/auth";

/** Liste des comptes (actifs et désactivés), recherche et filtres reflétés dans l'URL. */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    filter?: string | string[];
    notice?: string | string[];
  }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const rows = await loadUserRows(admin.id);
  const initialMessage =
    typeof params.notice === "string"
      ? (USER_LIST_NOTICES[params.notice] ?? "")
      : "";

  return (
    <section aria-labelledby="users-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="users-title" className="text-foreground text-xl font-semibold">
          Utilisateurs
        </h2>
        <Button asChild className="min-h-11">
          <Link href="/admin/users/new">Ajouter un utilisateur</Link>
        </Button>
      </div>
      <UsersTable
        rows={rows}
        initialFilters={parseUserListParams(params)}
        initialMessage={initialMessage}
      />
    </section>
  );
}
