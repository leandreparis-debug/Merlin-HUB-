import { PageContainer } from "@/components/layout/page-container";
import { requireAdmin } from "@/lib/auth";

/** Page provisoire « Espace administration », remplacée à l'étape 5. Réservée aux admins en vue admin. */
export default async function AdminPage() {
  await requireAdmin();

  return (
    <PageContainer className="py-10 sm:py-14">
      <h1 className="text-foreground text-3xl font-bold">
        Espace administration
      </h1>
      <p className="text-muted-foreground mt-3 max-w-2xl">
        La gestion des applications et des utilisateurs arrive aux prochaines
        étapes.
      </p>
    </PageContainer>
  );
}
