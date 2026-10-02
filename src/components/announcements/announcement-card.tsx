import { Pin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  splitAnnouncementText,
  type AnnouncementCardModel,
} from "@/lib/announcements/view-model";

/**
 * Carte d'une annonce (texte brut : jamais d'HTML ni de Markdown interprété,
 * retours à la ligne conservés). Au-delà de 280 caractères, la suite est
 * repliée dans un `<details>` natif (« Lire la suite »). Utilisée aussi pour
 * l'aperçu de l'administration.
 */
export function AnnouncementCard({
  announcement,
  showAbsoluteDate = false,
}: {
  announcement: AnnouncementCardModel;
  showAbsoluteDate?: boolean;
}) {
  const { head, tail } = splitAnnouncementText(announcement.text);

  return (
    <Card className="h-full gap-3" data-testid="announcement-card">
      <CardContent className="group space-y-3 [overflow-wrap:anywhere]">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-foreground text-lg leading-tight font-semibold">
            {announcement.title}
          </h3>
          {announcement.pinned ? (
            <Badge variant="secondary">
              <Pin aria-hidden="true" />
              Épinglée
            </Badge>
          ) : null}
        </div>

        {announcement.publishedLabel ? (
          <p className="text-muted-foreground text-xs">
            <time
              dateTime={announcement.publishedAt}
              title={announcement.publishedAbsolute}
            >
              {announcement.publishedLabel}
            </time>
            {showAbsoluteDate && announcement.publishedAbsolute
              ? ` · ${announcement.publishedAbsolute}`
              : null}
          </p>
        ) : null}

        <p className="text-foreground/80 text-sm whitespace-pre-line">
          {head}
          {tail ? (
            <span
              aria-hidden="true"
              className="group-has-[details[open]]:hidden"
            >
              …
            </span>
          ) : null}
        </p>

        {tail ? (
          <details className="text-sm">
            <summary className="text-primary focus-visible:ring-ring/50 min-h-11 cursor-pointer rounded-sm py-2 underline underline-offset-4 outline-none focus-visible:ring-[3px]">
              Lire la suite
              <span className="sr-only">
                {" "}
                de l&apos;annonce {announcement.title}
              </span>
            </summary>
            <p className="text-foreground/80 whitespace-pre-line">{tail}</p>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
