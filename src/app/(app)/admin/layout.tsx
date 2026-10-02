import { AdminNav } from "@/components/admin/admin-nav";
import { PageContainer } from "@/components/layout/page-container";
import { requireAdmin } from "@/lib/auth";

/**
 * Layout de l'administration : titre et sous-navigation. `requireAdmin()` est
 * appelé ici ET dans chaque page ET dans chaque server action : un layout
 * n'est pas réexécuté à chaque navigation, il ne protège jamais seul.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <PageContainer className="py-8 sm:py-10">
      <h1 className="text-foreground text-3xl font-bold">Administration</h1>
      <AdminNav />
      <div className="mt-8">{children}</div>
    </PageContainer>
  );
}
