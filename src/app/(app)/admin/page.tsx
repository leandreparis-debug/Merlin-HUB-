import Link from "next/link";

import { StatusEventList } from "@/components/admin/status-event-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadAdminDashboard } from "@/lib/admin/apps/data";
import { loadAnnouncementSummary } from "@/lib/admin/announcements/data";
import { loadUserSummary } from "@/lib/admin/users/data";
import { requireAdmin } from "@/lib/auth";
import { statusLabel } from "@/lib/catalogue/status";
import type { AppStatus } from "@/lib/data/types";

const STATUSES: AppStatus[] = ["online", "offline", "maintenance"];

function Tile({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardContent>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="text-foreground text-3xl font-bold">{value}</p>
        {detail ? (
          <p className="text-muted-foreground text-xs">{detail}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Tableau de bord d'administration : synthèse du catalogue et derniers changements de statut. */
export default async function AdminDashboardPage() {
  await requireAdmin();
  const { summary, events } = await loadAdminDashboard();
  const users = await loadUserSummary();
  const announcements = await loadAnnouncementSummary();

  return (
    <div className="space-y-10">
      <section aria-labelledby="dashboard-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="dashboard-title"
            className="text-foreground text-xl font-semibold"
          >
            Tableau de bord
          </h2>
          <Button asChild className="min-h-11">
            <Link href="/admin/apps/new">Ajouter une application</Link>
          </Button>
        </div>
        <div
          data-testid="dashboard-tiles"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Tile
            label="Applications"
            value={summary.total}
            detail={`${summary.visible} visible(s), ${summary.hidden} masquée(s)`}
          />
          {STATUSES.map((status) => (
            <Tile
              key={status}
              label={statusLabel(status)}
              value={summary.byStatus[status]}
            />
          ))}
          <Tile
            label="Sans URL (« Bientôt disponible »)"
            value={summary.withoutUrl}
          />
        </div>
      </section>

      <section aria-labelledby="users-tiles-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="users-tiles-title"
            className="text-foreground text-xl font-semibold"
          >
            Utilisateurs
          </h2>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/admin/users">Gérer les utilisateurs</Link>
          </Button>
        </div>
        <div
          data-testid="user-tiles"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Tile label="Comptes" value={users.total} />
          <Tile label="Comptes actifs" value={users.active} />
          <Tile label="Admins actifs" value={users.activeAdmins} />
          <Tile
            label="Première connexion en attente"
            value={users.pendingFirstLogin}
          />
        </div>
      </section>

      <section
        aria-labelledby="announcements-tiles-title"
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="announcements-tiles-title"
            className="text-foreground text-xl font-semibold"
          >
            Annonces
          </h2>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/admin/announcements">Gérer les annonces</Link>
          </Button>
        </div>
        <div
          data-testid="announcement-tiles"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Tile label="Publiées" value={announcements.published} />
          <Tile label="Épinglées" value={announcements.pinned} />
          <Tile label="Brouillons" value={announcements.drafts} />
        </div>
      </section>

      <section aria-labelledby="events-title" className="space-y-4">
        <h2 id="events-title" className="text-foreground text-xl font-semibold">
          Derniers changements de statut
        </h2>
        <StatusEventList
          events={events}
          showApp
          emptyMessage="Aucun changement de statut enregistré pour le moment."
        />
      </section>
    </div>
  );
}
