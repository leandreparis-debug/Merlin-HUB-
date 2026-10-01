"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

/** Page d'erreur générique affichée quand une erreur non gérée survient. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10 text-center">
      <p className="text-destructive text-sm font-semibold">Erreur</p>
      <h1 className="text-foreground text-2xl font-bold">
        Une erreur est survenue
      </h1>
      <p className="text-muted-foreground max-w-md">
        Quelque chose s&apos;est mal passé. Vous pouvez réessayer ou revenir à
        l&apos;accueil.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => reset()}>
          Réessayer
        </Button>
        <Button asChild>
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
