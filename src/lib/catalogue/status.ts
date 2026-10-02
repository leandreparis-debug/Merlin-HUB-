import type { AppStatus } from "@/lib/data/types";

/** Libellés français des statuts d'une application. */
export const STATUS_LABELS: Record<AppStatus, string> = {
  online: "En ligne",
  offline: "Hors ligne",
  maintenance: "Maintenance",
};

/** Libellé français d'un statut. */
export function statusLabel(status: AppStatus): string {
  return STATUS_LABELS[status];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const shortFormat = new Intl.RelativeTimeFormat("fr", {
  numeric: "auto",
  style: "short",
});
const longFormat = new Intl.RelativeTimeFormat("fr", {
  numeric: "auto",
  style: "long",
});

/**
 * Libellé relatif en français (« il y a 2 h », « hier », « à l'instant »)
 * d'une date ISO par rapport à `now` (injectable pour les tests). À calculer
 * côté serveur : jamais d'horloge dans un composant client (hydratation).
 */
export function formatRelativeTime(iso: string, now: Date): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "";
  const elapsed = now.getTime() - timestamp;

  if (elapsed < MINUTE) return "à l'instant";
  if (elapsed < HOUR) {
    return shortFormat.format(-Math.floor(elapsed / MINUTE), "minute");
  }
  if (elapsed < DAY) {
    return shortFormat.format(-Math.floor(elapsed / HOUR), "hour");
  }
  const days = Math.floor(elapsed / DAY);
  if (days < 7) return shortFormat.format(-days, "day");
  if (days < 30) return shortFormat.format(-Math.floor(days / 7), "week");
  if (days < 365) return longFormat.format(-Math.floor(days / 30), "month");
  return longFormat.format(-Math.floor(days / 365), "year");
}

/** Texte « mis à jour … » affiché sur une carte. */
export function updatedLabel(iso: string, now: Date): string {
  const relative = formatRelativeTime(iso, now);
  return relative ? `mis à jour ${relative}` : "";
}
