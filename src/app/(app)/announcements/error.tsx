"use client";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

/** Erreur de lecture des annonces : message générique en français, sans détail technique. */
export default function AnnouncementsError({ reset }: { reset: () => void }) {
  return (
    <PageContainer className="flex min-h-[40vh] flex-col items-start justify-center gap-4 py-10">
      <h1 className="text-foreground text-2xl font-bold">
        Impossible d&apos;afficher les annonces
      </h1>
      <p className="text-muted-foreground max-w-md" role="alert">
        Les annonces sont momentanément indisponibles. Réessayez dans quelques
        instants.
      </p>
      <Button onClick={() => reset()}>Réessayer</Button>
    </PageContainer>
  );
}
