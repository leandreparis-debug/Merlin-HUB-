import { CircleCheck, CircleX, Wrench, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/catalogue/status";
import { cn } from "@/lib/utils";
import type { AppStatus } from "@/lib/data/types";

const STATUS_STYLES: Record<
  AppStatus,
  { icon: LucideIcon; className: string }
> = {
  online: {
    icon: CircleCheck,
    className: "bg-status-online-bg text-status-online-text",
  },
  offline: {
    icon: CircleX,
    className: "bg-status-offline-bg text-status-offline-text",
  },
  maintenance: {
    icon: Wrench,
    className: "bg-status-maintenance-bg text-status-maintenance-text",
  },
};

/** Badge de statut : libellé texte + icône (le statut n'est jamais indiqué par la seule couleur). */
export function StatusBadge({ status }: { status: AppStatus }) {
  const { icon: Icon, className } = STATUS_STYLES[status];
  return (
    <Badge
      variant="outline"
      data-status={status}
      className={cn("border-transparent", className)}
    >
      <Icon aria-hidden="true" />
      {statusLabel(status)}
    </Badge>
  );
}
