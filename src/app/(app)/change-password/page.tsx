import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { PageContainer } from "@/components/layout/page-container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Changer mon mot de passe" };

/** Changement de mot de passe ; seule page accessible tant que le mot de passe provisoire n'est pas changé. */
export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });

  return (
    <PageContainer className="flex justify-center py-10 sm:py-14">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-xl leading-none font-semibold">
            Changer mon mot de passe
          </h1>
          {user.mustChangePassword ? (
            <CardDescription>
              Pour votre sécurité, choisissez un nouveau mot de passe avant de
              continuer.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
