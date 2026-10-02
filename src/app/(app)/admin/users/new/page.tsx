import Link from "next/link";

import { UserCreateForm } from "@/components/admin/user-create-form";
import { requireAdmin } from "@/lib/auth";
import { getPublicEnv } from "@/lib/env";

/** Création d'un compte avec mot de passe provisoire affiché une seule fois. */
export default async function NewUserPage() {
  await requireAdmin();
  const loginUrl = `${getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/login`;

  return (
    <section aria-labelledby="new-user-title" className="space-y-6">
      <div>
        <p className="text-sm">
          <Link
            href="/admin/users"
            className="text-primary underline underline-offset-4"
          >
            ← Retour à la liste
          </Link>
        </p>
        <h2
          id="new-user-title"
          className="text-foreground mt-2 text-xl font-semibold"
        >
          Ajouter un utilisateur
        </h2>
      </div>
      <UserCreateForm loginUrl={loginUrl} />
    </section>
  );
}
