import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { UserMenu } from "@/components/layout/user-menu";
import { ViewModeBanner } from "@/components/layout/view-mode-banner";
import { requireUser } from "@/lib/auth";
import { CHANGE_PASSWORD_PATH } from "@/lib/auth/constants";
import { getRequestPath } from "@/lib/auth/session";
import { getViewMode } from "@/lib/auth/view-mode";

// Toutes les pages de ce groupe dépendent de la session : jamais statiques.
export const dynamic = "force-dynamic";

/**
 * Layout des pages protégées : exige un utilisateur connecté (contrôle
 * serveur réel, indépendant du middleware), puis affiche l'en-tête avec le
 * menu utilisateur, le bandeau « vue utilisateur » éventuel, le contenu et
 * le pied de page. Chaque page et server action protégée refait aussi son
 * propre contrôle (`requireUser`/`requireAdmin`).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = await getRequestPath();
  const user = await requireUser({
    allowPasswordChange: path.split("?")[0] === CHANGE_PASSWORD_PATH,
  });
  const viewMode = await getViewMode(user);

  return (
    <>
      <Header userMenu={<UserMenu user={user} viewMode={viewMode} />} />
      {user.role === "admin" && viewMode === "user" ? <ViewModeBanner /> : null}
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
