import Link from "next/link";

import { AppForm } from "@/components/admin/app-form";
import { DeleteZone } from "@/components/admin/delete-zone";
import { StatusEventList } from "@/components/admin/status-event-list";
import { StatusPanel } from "@/components/admin/status-panel";
import { Button } from "@/components/ui/button";
import { loadAdminAppDetail, loadCategories } from "@/lib/admin/apps/data";
import { formValuesFromDetail } from "@/lib/admin/apps/form";
import { requireAdmin } from "@/lib/auth";

const NOTICES: Record<string, string> = {
  created: "L'application a été créée.",
};

/** Fiche d'administration d'une application : informations, statut, journal, suppression. */
export default async function AdminAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { notice } = await searchParams;
  const detail = await loadAdminAppDetail(id);

  if (!detail) {
    return (
      <section className="space-y-4" aria-labelledby="not-found-title">
        <h2 id="not-found-title" className="text-xl font-semibold">
          Application introuvable
        </h2>
        <p className="text-muted-foreground">
          Cette application n&apos;existe pas ou n&apos;existe plus.
        </p>
        <Button asChild className="min-h-11">
          <Link href="/admin/apps">Retour à la liste</Link>
        </Button>
      </section>
    );
  }

  const { app, events } = detail;
  const categories = await loadCategories();
  const message = typeof notice === "string" ? NOTICES[notice] : undefined;

  return (
    <div className="space-y-12">
      <div>
        <p className="text-sm">
          <Link
            href="/admin/apps"
            className="text-primary underline underline-offset-4"
          >
            ← Retour à la liste
          </Link>
        </p>
        <h2 className="text-foreground mt-2 text-xl font-semibold">
          {app.name}
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

      <section aria-labelledby="info-title" className="space-y-4">
        <h3 id="info-title" className="text-lg font-semibold">
          Informations
        </h3>
        <AppForm
          mode="edit"
          appId={app.id}
          initial={formValuesFromDetail(app)}
          categories={categories}
          updatedLabel={
            app.statusUpdatedLabel ? `mis à jour ${app.statusUpdatedLabel}` : ""
          }
          statusPreview={{ status: app.status, statusNote: app.statusMessage }}
        />
      </section>

      <section aria-labelledby="status-title" className="space-y-4">
        <h3 id="status-title" className="text-lg font-semibold">
          Statut
        </h3>
        <StatusPanel
          key={`${app.status}-${app.statusMessage}-${app.updatedAt}`}
          appId={app.id}
          status={app.status}
          message={app.statusMessage}
          updatedAbsolute={app.statusUpdatedAbsolute}
          updatedRelative={app.statusUpdatedLabel}
        />
      </section>

      <section aria-labelledby="journal-title" className="space-y-4">
        <h3 id="journal-title" className="text-lg font-semibold">
          Journal des changements de statut
        </h3>
        <StatusEventList
          events={events}
          showApp={false}
          emptyMessage="Aucun changement enregistré"
        />
      </section>

      <section aria-labelledby="danger-title" className="space-y-4">
        <h3 id="danger-title" className="text-lg font-semibold">
          Zone dangereuse
        </h3>
        <DeleteZone appId={app.id} appName={app.name} />
      </section>
    </div>
  );
}
