import Image from "next/image";
import type { ReactNode } from "react";

import { APP_NAME, APP_SUBTITLE } from "@/lib/constants";
import { PageContainer } from "@/components/layout/page-container";

const LOGO_PUBLIC_PATH = "/brand/carrefour-property-logo.png";
/** Logo Carrefour Property (fichier servi depuis `public/brand`). */
function BrandMark() {
  return (
    <Image
      src={LOGO_PUBLIC_PATH}
      alt="Carrefour Property"
      width={44}
      height={44}
      className="h-11 w-11 object-contain"
      priority
    />
  );
}

/**
 * En-tête de l'application : logo Carrefour Property, nom et sous-titre de
 * Merlin à gauche, menu utilisateur (`userMenu`) à droite. Sans `userMenu`
 * (page de connexion, 404), l'en-tête est en mode « non connecté ».
 */
export function Header({ userMenu }: { userMenu?: ReactNode } = {}) {
  return (
    <header className="border-border bg-card border-b">
      <PageContainer className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BrandMark />
          <span aria-hidden="true" className="bg-border h-8 w-px" />
          <div className="flex flex-col leading-tight">
            <span className="text-foreground font-bold">{APP_NAME}</span>
            <span className="text-muted-foreground hidden text-xs sm:block">
              {APP_SUBTITLE}
            </span>
          </div>
        </div>
        {userMenu}
      </PageContainer>
    </header>
  );
}
