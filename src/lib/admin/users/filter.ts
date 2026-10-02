import { MAX_QUERY_LENGTH, normalizeText } from "@/lib/catalogue/filter";
import type { AdminUserRow } from "@/lib/admin/users/view-models";

/** Filtres rapides de la liste. */
export const USER_FILTERS = [
  "all",
  "active",
  "inactive",
  "admins",
  "pending",
] as const;

export type UserFilter = (typeof USER_FILTERS)[number];

/** Libellés français des filtres rapides. */
export const USER_FILTER_LABELS: Record<UserFilter, string> = {
  all: "Tous",
  active: "Actifs",
  inactive: "Désactivés",
  admins: "Admins",
  pending: "Première connexion en attente",
};

/** État des filtres de la liste (`?q=` et `?filter=`). */
export interface UserListFilters {
  q: string;
  filter: UserFilter;
}

/** Valide les paramètres d'URL : filtre inconnu → « Tous », `q` limité et nettoyé. */
export function parseUserListParams(params: {
  q?: string | string[] | undefined;
  filter?: string | string[] | undefined;
}): UserListFilters {
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? "";
  const q = first(params.q)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, MAX_QUERY_LENGTH);
  const filter = first(params.filter);
  return {
    q,
    filter: (USER_FILTERS as readonly string[]).includes(filter)
      ? (filter as UserFilter)
      : "all",
  };
}

function matchesFilter(row: AdminUserRow, filter: UserFilter): boolean {
  switch (filter) {
    case "active":
      return row.isActive;
    case "inactive":
      return !row.isActive;
    case "admins":
      return row.role === "admin";
    case "pending":
      return row.mustChangePassword && row.isActive;
    default:
      return true;
  }
}

/** Recherche (nom ou email, insensible à la casse et aux accents) combinée au filtre rapide. */
export function filterUsers(
  rows: readonly AdminUserRow[],
  filters: UserListFilters,
): AdminUserRow[] {
  const query = normalizeText(filters.q.slice(0, MAX_QUERY_LENGTH));
  return rows.filter((row) => {
    if (!matchesFilter(row, filters.filter)) return false;
    if (!query) return true;
    return normalizeText(`${row.fullName ?? ""} ${row.email}`).includes(query);
  });
}
