import Link from "next/link";

import { PublicShell } from "@/components/layout/public-shell";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

/** Page 404 publique (accessible sans connexion) affichée pour toute URL inexistante. */
export default function NotFound() {
  return (
    <PublicShell>
      <PageContainer className="flex min-h-[60vh] flex-col items-center justify-center gap-4 py-10 text-center">
        <p className="text-primary text-sm font-semibold">Erreur 404</p>
        <h1 className="text-foreground text-2xl font-bold">
          Cette page n&apos;existe pas
        </h1>
        <p className="text-muted-foreground max-w-md">
          La page que vous cherchez est introuvable. Elle a peut-être été
          déplacée ou n&apos;a jamais existé.
        </p>
        <Button asChild>
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
      </PageContainer>
    </PublicShell>
  );
}
