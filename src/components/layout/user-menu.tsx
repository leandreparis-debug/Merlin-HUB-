"use client";

import Link from "next/link";
import { useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction, toggleViewModeAction } from "@/lib/auth/actions";
import type { SessionUser, ViewMode } from "@/lib/auth/types";

/** Initiales (2 lettres max) d'après le nom, sinon l'email. */
function initialsOf(user: Pick<SessionUser, "fullName" | "email">): string {
  const source = user.fullName?.trim() || user.email.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts.slice(0, 2) : [source.slice(0, 2)];
  return letters
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

/**
 * Menu utilisateur de l'en-tête : identité, rôle, changement de mot de passe,
 * pour un admin l'espace administration et la bascule vue admin/utilisateur,
 * puis déconnexion. En changement de mot de passe forcé, seul « Se
 * déconnecter » est proposé. La bascule est cosmétique : elle ne donne aucun droit.
 */
export function UserMenu({
  user,
  viewMode,
}: {
  user: Pick<SessionUser, "email" | "fullName" | "role" | "mustChangePassword">;
  viewMode: ViewMode;
}) {
  const [pending, startTransition] = useTransition();
  const isAdmin = user.role === "admin";
  const restricted = user.mustChangePassword;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 max-w-full gap-2 px-2 sm:px-3"
          aria-label={`Menu utilisateur, ${user.email}`}
          disabled={pending}
        >
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          >
            {initialsOf(user)}
          </span>
          <span className="text-muted-foreground hidden max-w-48 truncate text-sm sm:inline">
            {user.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" aria-label="Menu utilisateur">
        <DropdownMenuLabel className="space-y-1">
          {user.fullName ? (
            <span className="block font-medium">{user.fullName}</span>
          ) : null}
          <span className="text-muted-foreground block max-w-60 truncate text-xs">
            {user.email}
          </span>
          <Badge variant={isAdmin ? "default" : "secondary"}>
            {isAdmin ? "Admin" : "Utilisateur"}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {restricted ? null : (
          <>
            <DropdownMenuItem asChild>
              <Link href="/change-password">Changer mon mot de passe</Link>
            </DropdownMenuItem>
            {isAdmin && viewMode === "admin" ? (
              <DropdownMenuItem asChild>
                <Link href="/admin">Espace administration</Link>
              </DropdownMenuItem>
            ) : null}
            {isAdmin ? (
              <DropdownMenuItem
                onSelect={() =>
                  startTransition(async () => {
                    await toggleViewModeAction();
                  })
                }
              >
                {viewMode === "admin"
                  ? "Passer en vue utilisateur"
                  : "Revenir en vue admin"}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onSelect={() =>
            startTransition(async () => {
              await logoutAction();
            })
          }
        >
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
