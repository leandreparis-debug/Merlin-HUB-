import { AppIcon } from "@/components/catalogue/app-icon";
import { StatusBadge } from "@/components/catalogue/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AppCardModel } from "@/lib/catalogue/view-model";

const LINK_CLASS =
  "text-primary focus-visible:ring-ring/50 rounded-sm underline underline-offset-4 outline-none focus-visible:ring-[3px]";

/**
 * Carte d'une application du catalogue. Un seul lien principal (« Ouvrir », nouvel
 * onglet) même si le statut est hors ligne ou en maintenance (statut saisi à la
 * main, potentiellement périmé) ; sans URL valide, bouton désactivé « Bientôt
 * disponible ». Aucun HTML brut n'est injecté depuis les données.
 */
export function AppCard({ app }: { app: AppCardModel }) {
  return (
    <Card className="h-full gap-4" data-testid="app-card">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="bg-accent text-accent-foreground flex size-11 shrink-0 items-center justify-center rounded-lg"
          >
            <AppIcon name={app.icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-foreground text-lg leading-tight font-semibold">
                {app.name}
              </h2>
              {app.isNew ? <Badge>Nouveau</Badge> : null}
            </div>
            {app.category ? (
              <p className="text-muted-foreground text-sm">{app.category}</p>
            ) : null}
          </div>
        </div>

        {app.description ? (
          <p className="text-foreground/80 text-sm">{app.description}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status={app.status} />
          {app.version ? (
            <span className="text-muted-foreground text-xs">
              Version {app.version}
            </span>
          ) : null}
          {app.updatedLabel ? (
            <span className="text-muted-foreground text-xs">
              {app.updatedLabel}
            </span>
          ) : null}
        </div>

        {app.statusMessage ? (
          <p
            data-testid="status-message"
            className="bg-muted text-foreground rounded-md px-3 py-2 text-sm"
          >
            {app.statusMessage}
          </p>
        ) : null}

        {app.ownerName || app.ownerEmail ? (
          <p className="text-muted-foreground text-sm">
            {app.ownerName ? <>Responsable : {app.ownerName}</> : null}
            {app.ownerName && app.ownerEmail ? " · " : null}
            {app.ownerEmail ? (
              <a href={`mailto:${app.ownerEmail}`} className={LINK_CLASS}>
                Contacter
                <span className="sr-only"> le responsable de {app.name}</span>
              </a>
            ) : null}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 pt-2">
          {app.openUrl ? (
            <Button asChild className="min-h-11 w-full">
              <a href={app.openUrl} target="_blank" rel="noopener noreferrer">
                Ouvrir
                <span className="sr-only"> {app.name} (nouvel onglet)</span>
              </a>
            </Button>
          ) : (
            <Button disabled className="min-h-11 w-full">
              Bientôt disponible
            </Button>
          )}
          {app.docUrl ? (
            <a
              href={app.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${LINK_CLASS} self-start text-sm`}
            >
              Documentation
              <span className="sr-only"> de {app.name} (nouvel onglet)</span>
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
