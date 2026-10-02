import { AnnouncementsZone } from "@/components/announcements/announcements-zone";
import { CatalogueView } from "@/components/catalogue/catalogue-view";
import { NoticeBanner } from "@/components/layout/notice-banner";
import { PageContainer } from "@/components/layout/page-container";
import { loadHomeAnnouncements } from "@/lib/announcements/data";
import { requireUser } from "@/lib/auth";
import { categoriesOf, parseCatalogueParams } from "@/lib/catalogue/filter";
import { loadCatalogue } from "@/lib/catalogue/data";

type SearchParams = Promise<{
  notice?: string | string[];
  q?: string | string[];
  cat?: string | string[];
}>;

/** Premier mot du nom complet, ou `null`. */
function firstName(fullName: string | null): string | null {
  return fullName?.trim().split(/\s+/)[0] || null;
}

/**
 * Page d'accueil : catalogue des applications visibles (`listVisible()` pour
 * tous, admin compris), recherche et filtre par catégorie reflétés dans l'URL.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const apps = await loadCatalogue();
  // Une panne des annonces ne doit jamais masquer le catalogue.
  const announcements = await loadHomeAnnouncements().then(
    (result) => ({ ...result, unavailable: false }),
    () => ({ items: [], hasMore: false, unavailable: true }),
  );
  const initialFilters = parseCatalogueParams(params, categoriesOf(apps));
  const name = firstName(user.fullName);

  return (
    <PageContainer className="py-10 sm:py-14">
      {params.notice === "password-changed" ? (
        <NoticeBanner>Votre mot de passe a bien été modifié.</NoticeBanner>
      ) : null}

      <h1 className="text-foreground text-3xl font-bold">Vos applications</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl">
        {name ? `Bonjour ${name}` : "Bonjour"}, retrouvez ici les outils
        internes Carrefour Property.
      </p>

      <AnnouncementsZone {...announcements} />

      <CatalogueView apps={apps} initialFilters={initialFilters} />
    </PageContainer>
  );
}
