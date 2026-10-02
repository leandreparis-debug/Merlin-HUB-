import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { getPublicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Connexion" };

// La page dépend de la session (redirection si déjà connecté) : jamais statique.
export const dynamic = "force-dynamic";

/** Page de connexion (email pro + mot de passe) ; un utilisateur déjà connecté est renvoyé vers `next` ou `/`. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const safeNext = safeRedirectPath(next);

  // Contrôle réel côté serveur (profil actif lu en base), plus fiable que
  // la seule présence d'un cookie dans le middleware.
  if (await getCurrentUser()) redirect(safeNext);

  return (
    <PageContainer className="flex justify-center py-10 sm:py-14">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl leading-none font-semibold">
            Connexion à Merlin
          </h1>
        </CardHeader>
        <CardContent>
          <LoginForm
            next={safeNext}
            contactEmail={getPublicEnv().NEXT_PUBLIC_ADMIN_CONTACT_EMAIL}
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
