"use client";

import { useEffect, useMemo, useState } from "react";

import { AppCard } from "@/components/catalogue/app-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_QUERY_LENGTH,
  categoriesOf,
  filterApps,
  type CatalogueFilters,
} from "@/lib/catalogue/filter";
import type { AppCardModel } from "@/lib/catalogue/view-model";
import { cn } from "@/lib/utils";

/** Reflète les filtres dans l'URL (`?q=`, `?cat=`) sans rechargement ni saut de scroll. */
function syncUrl({ q, cat }: CatalogueFilters): void {
  const url = new URL(window.location.href);
  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  if (cat) url.searchParams.set("cat", cat);
  else url.searchParams.delete("cat");
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (
    next !==
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  ) {
    window.history.replaceState(window.history.state, "", next);
  }
}

function countLabel(count: number): string {
  if (count === 0) return "Aucune application";
  return `${count} application${count > 1 ? "s" : ""}`;
}

/**
 * Catalogue filtrable côté client (liste déjà chargée, quelques dizaines
 * d'apps au plus) : recherche insensible à la casse et aux accents, filtre de
 * catégorie, compteur `aria-live`, états vides. `initialFilters` vient des
 * paramètres d'URL validés côté serveur.
 */
export function CatalogueView({
  apps,
  initialFilters,
}: {
  apps: AppCardModel[];
  initialFilters: CatalogueFilters;
}) {
  const [q, setQ] = useState(initialFilters.q);
  const [cat, setCat] = useState(initialFilters.cat);

  const categories = useMemo(() => categoriesOf(apps), [apps]);
  const results = useMemo(() => filterApps(apps, { q, cat }), [apps, q, cat]);

  useEffect(() => {
    syncUrl({ q, cat });
  }, [q, cat]);

  if (apps.length === 0) {
    return (
      <p className="text-muted-foreground mt-8" data-testid="catalogue-empty">
        Aucune application disponible pour le moment.
      </p>
    );
  }

  const reset = () => {
    setQ("");
    setCat("");
  };

  return (
    <div className="mt-8 space-y-6">
      <div className="space-y-4">
        <form
          role="search"
          onSubmit={(event) => event.preventDefault()}
          className="max-w-md space-y-2"
        >
          <Label htmlFor="catalogue-search">Rechercher une application</Label>
          <Input
            id="catalogue-search"
            name="q"
            type="search"
            autoComplete="off"
            maxLength={MAX_QUERY_LENGTH}
            placeholder="Nom, description ou catégorie"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </form>

        {categories.length > 1 ? (
          <div
            role="group"
            aria-label="Filtrer par catégorie"
            className="flex flex-wrap gap-2"
          >
            {["", ...categories].map((category) => {
              const pressed = cat === category;
              return (
                <button
                  key={category || "all"}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setCat(category)}
                  className={cn(
                    "focus-visible:ring-ring/50 min-h-9 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]",
                    pressed
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-accent",
                  )}
                >
                  {category || "Toutes"}
                </button>
              );
            })}
          </div>
        ) : null}

        <p
          aria-live="polite"
          aria-atomic="true"
          data-testid="result-count"
          className="text-muted-foreground text-sm"
        >
          {countLabel(results.length)}
        </p>
      </div>

      {results.length === 0 ? (
        <div
          data-testid="no-results"
          className="border-border bg-card flex flex-col items-start gap-3 rounded-lg border p-6"
        >
          <p className="text-foreground">
            Aucune application ne correspond à votre recherche.
          </p>
          <Button variant="outline" onClick={reset}>
            Réinitialiser les filtres
          </Button>
        </div>
      ) : (
        <ul
          data-testid="app-grid"
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {results.map((app) => (
            <li key={app.id}>
              <AppCard app={app} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
