import { CircleCheck, FilePen, Pin } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/** Pastille d'état « Publiée » / « Brouillon » : texte ET icône (jamais la couleur seule). */
export function PublicationBadge({ published }: { published: boolean }) {
  return published ? (
    <Badge className="bg-status-online-bg text-status-online-text">
      <CircleCheck aria-hidden="true" />
      Publiée
    </Badge>
  ) : (
    <Badge variant="outline">
      <FilePen aria-hidden="true" />
      Brouillon
    </Badge>
  );
}

/** Pastille « Épinglée » : texte ET icône. */
export function PinnedBadge() {
  return (
    <Badge variant="secondary">
      <Pin aria-hidden="true" />
      Épinglée
    </Badge>
  );
}
