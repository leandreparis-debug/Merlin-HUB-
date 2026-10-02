import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** État de chargement de `/announcements` : squelettes de cartes. */
export default function Loading() {
  return (
    <PageContainer
      className="py-10 sm:py-14"
      role="status"
      aria-label="Chargement des annonces"
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 h-9 w-48" />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <CardContent className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
