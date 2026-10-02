import Link from "next/link";

import {
  UserAccessForm,
  UserInfoForm,
  UserPasswordForm,
  UserRoleForm,
} from "@/components/admin/user-detail-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { loadUserDetail } from "@/lib/admin/users/data";
import { requireAdmin } from "@/lib/auth";
import { getPublicEnv } from "@/lib/env";

/** Fiche d'un utilisateur : informations, rôle, accès, mot de passe et activité récente. */
export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const detail = await loadUserDetail(id, admin.id);

  if (!detail) {
    return (
      <section className="space-y-4" aria-labelledby="not-found-title">
        <h2 id="not-found-title" className="text-xl font-semibold">
          Utilisateur introuvable
        </h2>
        <p className="text-muted-foreground">
          Cet utilisateur n&apos;existe pas ou n&apos;existe plus.
        </p>
        <Button asChild className="min-h-11">
          <Link href="/admin/users">Retour à la liste</Link>
        </Button>
      </section>
    );
  }

  const { user, activity } = detail;
  const loginUrl = `${getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/login`;

  return (
    <div className="space-y-12">
      <div>
        <p className="text-sm">
          <Link
            href="/admin/users"
            className="text-primary underline underline-offset-4"
          >
            ← Retour à la liste
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-foreground text-xl font-semibold">
            {user.fullName || user.email}
          </h2>
          {user.isSelf ? <Badge variant="outline">Vous</Badge> : null}
          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
            {user.role === "admin" ? "Admin" : "Utilisateur"}
          </Badge>
          <Badge variant={user.isActive ? "outline" : "secondary"}>
            {user.isActive ? "Actif" : "Désactivé"}
          </Badge>
          {user.mustChangePassword ? (
            <Badge variant="secondary">Première connexion en attente</Badge>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="info-title" className="space-y-4">
        <h3 id="info-title" className="text-lg font-semibold">
          Informations
        </h3>
        <dl className="grid max-w-xl gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Compte créé le</dt>
            <dd>{user.createdAbsolute}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Dernière connexion</dt>
            <dd>
              {user.lastLoginAbsolute
                ? `${user.lastLoginAbsolute} (${user.lastLoginLabel})`
                : user.lastLoginLabel}
            </dd>
          </div>
        </dl>
        <UserInfoForm user={user} />
      </section>

      <section aria-labelledby="role-title" className="space-y-4">
        <h3 id="role-title" className="text-lg font-semibold">
          Rôle
        </h3>
        <UserRoleForm user={user} />
      </section>

      <section aria-labelledby="access-title" className="space-y-4">
        <h3 id="access-title" className="text-lg font-semibold">
          Accès
        </h3>
        <UserAccessForm user={user} />
      </section>

      <section aria-labelledby="password-title" className="space-y-4">
        <h3 id="password-title" className="text-lg font-semibold">
          Mot de passe
        </h3>
        <UserPasswordForm user={user} loginUrl={loginUrl} />
      </section>

      <section aria-labelledby="activity-title" className="space-y-4">
        <h3 id="activity-title" className="text-lg font-semibold">
          Activité récente
        </h3>
        {activity.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune activité enregistrée pour ce compte.
          </p>
        ) : (
          <ol className="divide-border divide-y" data-testid="user-activity">
            {activity.map((entry) => (
              <li key={entry.id} className="space-y-1 py-3">
                <p className="text-sm font-medium">{entry.label}</p>
                <p className="text-muted-foreground text-xs">
                  {entry.absoluteDate}
                  {entry.relativeDate ? ` (${entry.relativeDate})` : null}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
