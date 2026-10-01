import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Page d'accueil provisoire de Merlin. Sera remplacée à l'étape 4 par le
 * catalogue réel des applications Carrefour Property.
 */
export default function Home() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <h1 className="text-foreground text-3xl font-bold">
        Bienvenue sur Merlin
      </h1>
      <p className="text-muted-foreground mt-3 max-w-2xl">
        Le catalogue des applications internes Carrefour Property arrivera
        bientôt ici. En attendant, voici un aperçu de la mise en page.
      </p>

      <div
        data-testid="app-grid"
        className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {[0, 1, 2].map((index) => (
          <Card key={index}>
            <CardHeader>
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-9 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
