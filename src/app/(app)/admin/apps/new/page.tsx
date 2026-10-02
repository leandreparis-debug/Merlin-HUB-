import Link from "next/link";

import { AppForm } from "@/components/admin/app-form";
import { loadCategories } from "@/lib/admin/apps/data";
import { EMPTY_APP_FORM } from "@/lib/admin/apps/form";
import { requireAdmin } from "@/lib/auth";

/** Création d'une application, avec aperçu en direct de sa carte. */
export default async function NewAppPage() {
  await requireAdmin();
  const categories = await loadCategories();

  return (
    <section aria-labelledby="new-app-title" className="space-y-6">
      <div>
        <p className="text-sm">
          <Link
            href="/admin/apps"
            className="text-primary underline underline-offset-4"
          >
            ← Retour à la liste
          </Link>
        </p>
        <h2
          id="new-app-title"
          className="text-foreground mt-2 text-xl font-semibold"
        >
          Ajouter une application
        </h2>
      </div>
      <AppForm
        mode="create"
        initial={EMPTY_APP_FORM}
        categories={categories}
        updatedLabel="mis à jour à l'instant"
      />
    </section>
  );
}
