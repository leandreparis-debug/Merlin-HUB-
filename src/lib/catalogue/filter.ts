import type { AppCardModel } from "@/lib/catalogue/view-model";

/** Longueur maximale acceptée pour la recherche (`?q=`). */
export const MAX_QUERY_LENGTH = 100;

/** Filtres du catalogue : texte libre et catégorie (`""` = toutes). */
export interface CatalogueFilters {
  q: string;
  cat: string;
}

/** Minuscules sans accents, pour une comparaison insensible à la casse et aux accents. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Trie par `sortOrder` croissant puis par nom (ordre alphabétique français). Retourne une nouvelle liste. */
export function sortApps<T extends { sortOrder: number; name: string }>(
  apps: readonly T[],
): T[] {
  return [...apps].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"),
  );
}

/** Catégories présentes, sans doublon, triées alphabétiquement (ordre français). */
export function categoriesOf(apps: readonly AppCardModel[]): string[] {
  return [...new Set(apps.map((app) => app.category).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "fr"),
  );
}

/**
 * Filtre sur nom, description et catégorie (recherche insensible à la casse
 * et aux accents) combiné à la catégorie choisie. Une catégorie inconnue est
 * traitée comme « toutes ». L'ordre d'entrée est conservé.
 */
export function filterApps(
  apps: readonly AppCardModel[],
  filters: CatalogueFilters,
): AppCardModel[] {
  const query = normalizeText(filters.q.slice(0, MAX_QUERY_LENGTH));
  const category = categoriesOf(apps).includes(filters.cat) ? filters.cat : "";

  return apps.filter((app) => {
    if (category && app.category !== category) return false;
    if (!query) return true;
    return normalizeText(
      `${app.name} ${app.description} ${app.category}`,
    ).includes(query);
  });
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Valide les paramètres d'URL `?q=` et `?cat=` : `q` est nettoyé et limité à
 * {@link MAX_QUERY_LENGTH} caractères ; une catégorie inconnue devient « toutes ».
 */
export function parseCatalogueParams(
  params: {
    q?: string | string[] | undefined;
    cat?: string | string[] | undefined;
  },
  categories: readonly string[],
): CatalogueFilters {
  const q = firstValue(params.q)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, MAX_QUERY_LENGTH);
  const cat = firstValue(params.cat);
  return { q, cat: categories.includes(cat) ? cat : "" };
}
