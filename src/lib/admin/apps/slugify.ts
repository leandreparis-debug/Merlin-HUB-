const MAX_SLUG_LENGTH = 60;

/**
 * Génère un slug à partir d'un nom : minuscules, sans accents, tirets simples,
 * 60 caractères au plus. Un nom sans lettre ni chiffre donne une chaîne vide
 * (invalide pour le schéma, qui exige au moins 2 caractères).
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}
