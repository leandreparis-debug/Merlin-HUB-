import "server-only";

import { sortApps } from "@/lib/catalogue/filter";
import { toAppCardModel, type AppCardModel } from "@/lib/catalogue/view-model";
import { getUserRepositories } from "@/lib/data";

/** Erreur générique de lecture du catalogue : aucun détail interne n'est exposé. */
export class CatalogueLoadError extends Error {
  constructor() {
    super("Le catalogue est momentanément indisponible.");
    this.name = "CatalogueLoadError";
  }
}

/**
 * Applications visibles pour l'utilisateur courant (`listVisible()` pour tous,
 * y compris un admin), triées, sous forme de view models sérialisables. Passe
 * par `getUserRepositories()` (RLS appliquée). Toute erreur de lecture devient
 * une {@link CatalogueLoadError} générique ; `now` est injectable pour les tests.
 */
export async function loadCatalogue(
  now: Date = new Date(),
): Promise<AppCardModel[]> {
  try {
    const repositories = await getUserRepositories();
    const visible = await repositories.apps.listVisible();
    // Défense en profondeur : une app masquée ne doit jamais atteindre le navigateur.
    const apps = sortApps(visible.filter((app) => !app.isHidden));
    return apps.map((app) => toAppCardModel(app, now));
  } catch {
    console.error("Échec de la lecture du catalogue d'applications.");
    throw new CatalogueLoadError();
  }
}
