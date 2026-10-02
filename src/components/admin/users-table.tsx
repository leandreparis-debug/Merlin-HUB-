"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  USER_FILTERS,
  USER_FILTER_LABELS,
  filterUsers,
  type UserFilter,
  type UserListFilters,
} from "@/lib/admin/users/filter";
import type { AdminUserRow } from "@/lib/admin/users/view-models";
import { MAX_QUERY_LENGTH } from "@/lib/catalogue/filter";
import { cn } from "@/lib/utils";

/** Reflète les filtres dans l'URL (`?q=`, `?filter=`) sans rechargement ni saut de scroll. */
function syncUrl({ q, filter }: UserListFilters): void {
  const url = new URL(window.location.href);
  if (q) url.searchParams.set("q", q);
  else url.searchParams.delete("q");
  if (filter !== "all") url.searchParams.set("filter", filter);
  else url.searchParams.delete("filter");
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) {
    window.history.replaceState(window.history.state, "", next);
  }
}

function countLabel(count: number): string {
  if (count === 0) return "Aucun utilisateur";
  return `${count} utilisateur${count > 1 ? "s" : ""}`;
}

/**
 * Liste des comptes avec recherche (nom ou email, insensible à la casse et
 * aux accents) et filtres rapides combinables (`aria-pressed`), reflétés dans
 * l'URL. Le tableau défile dans son propre conteneur sur petit écran.
 */
export function UsersTable({
  rows,
  initialFilters,
  initialMessage = "",
}: {
  rows: AdminUserRow[];
  initialFilters: UserListFilters;
  initialMessage?: string;
}) {
  const [q, setQ] = useState(initialFilters.q);
  const [filter, setFilter] = useState<UserFilter>(initialFilters.filter);
  const results = useMemo(
    () => filterUsers(rows, { q, filter }),
    [rows, q, filter],
  );

  useEffect(() => {
    syncUrl({ q, filter });
  }, [q, filter]);

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground" data-testid="users-empty">
        Aucun compte pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {initialMessage ? (
        <p role="status" className="text-sm font-medium">
          {initialMessage}
        </p>
      ) : null}

      <form
        role="search"
        onSubmit={(event) => event.preventDefault()}
        className="max-w-md space-y-2"
      >
        <Label htmlFor="users-search">Rechercher un utilisateur</Label>
        <Input
          id="users-search"
          name="q"
          type="search"
          autoComplete="off"
          maxLength={MAX_QUERY_LENGTH}
          placeholder="Nom ou email"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </form>

      <div
        role="group"
        aria-label="Filtrer les utilisateurs"
        className="flex flex-wrap gap-2"
      >
        {USER_FILTERS.map((value) => {
          const pressed = filter === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={pressed}
              onClick={() => setFilter(value)}
              className={cn(
                "focus-visible:ring-ring/50 min-h-11 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]",
                pressed
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent",
              )}
            >
              {USER_FILTER_LABELS[value]}
            </button>
          );
        })}
      </div>

      <p
        aria-live="polite"
        aria-atomic="true"
        data-testid="users-count"
        className="text-muted-foreground text-sm"
      >
        {countLabel(results.length)}
      </p>

      {results.length === 0 ? (
        <div
          data-testid="users-no-results"
          className="border-border bg-card flex flex-col items-start gap-3 rounded-lg border p-6"
        >
          <p>Aucun utilisateur ne correspond à votre recherche.</p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setQ("");
              setFilter("all");
            }}
          >
            Réinitialiser les filtres
          </Button>
        </div>
      ) : (
        <div
          role="region"
          aria-label="Liste des utilisateurs"
          tabIndex={0}
          className="border-border bg-card focus-visible:ring-ring/50 relative overflow-x-auto rounded-lg border outline-none focus-visible:ring-[3px]"
        >
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">
              Comptes utilisateurs de Merlin
            </caption>
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th scope="col" className="px-3 py-3">
                  Nom
                </th>
                <th scope="col" className="px-3 py-3">
                  Email
                </th>
                <th scope="col" className="px-3 py-3">
                  Rôle
                </th>
                <th scope="col" className="px-3 py-3">
                  État
                </th>
                <th scope="col" className="px-3 py-3">
                  Dernière connexion
                </th>
                <th scope="col" className="px-3 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {results.map((row) => (
                <tr
                  key={row.id}
                  data-testid="user-row"
                  className={cn(!row.isActive && "bg-muted/60")}
                >
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.fullName ?? "—"}</span>
                      {row.isSelf ? (
                        <Badge variant="outline">Vous</Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.email}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant={row.role === "admin" ? "default" : "secondary"}
                    >
                      {row.role === "admin" ? "Admin" : "Utilisateur"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col items-start gap-1">
                      <Badge variant={row.isActive ? "outline" : "secondary"}>
                        {row.isActive ? "Actif" : "Désactivé"}
                      </Badge>
                      {row.mustChangePassword ? (
                        <span className="text-muted-foreground text-xs">
                          Première connexion en attente
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">{row.lastLoginLabel}</td>
                  <td className="px-3 py-2">
                    <Button asChild variant="secondary" className="min-h-11">
                      <Link href={`/admin/users/${row.id}`}>
                        Gérer
                        <span className="sr-only">
                          {" "}
                          {row.fullName ?? row.email}
                        </span>
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
