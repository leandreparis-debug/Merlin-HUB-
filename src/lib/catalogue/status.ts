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

/** `Intl` insère des espaces insécables fines : on les normalise en espace simple. */
function plain(text: string): string {
  return text.replace(/[\u00a0\u202f]/g, " ");
}

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
    return plain(shortFormat.format(-Math.floor(elapsed / MINUTE), "minute"));
  }
  if (elapsed < DAY) {
    return plain(shortFormat.format(-Math.floor(elapsed / HOUR), "hour"));
  }
  const days = Math.floor(elapsed / DAY);
  if (days < 7) return plain(shortFormat.format(-days, "day"));
  if (days < 30)
    return plain(shortFormat.format(-Math.floor(days / 7), "week"));
  if (days < 365)
    return plain(longFormat.format(-Math.floor(days / 30), "month"));
  return plain(longFormat.format(-Math.floor(days / 365), "year"));
}

/** Texte « mis à jour … » affiché sur une carte. */
export function updatedLabel(iso: string, now: Date): string {
  const relative = formatRelativeTime(iso, now);
  return relative ? `mis à jour ${relative}` : "";
}

const parisFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

/** Date absolue lisible au fuseau Europe/Paris (ex. « 2 oct. 2026, 14:30 »), formatée côté serveur. */
export function formatAbsoluteParis(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return "";
  return plain(parisFormat.format(new Date(timestamp)));
}
