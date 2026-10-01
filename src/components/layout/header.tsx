import fs from "node:fs";
import path from "node:path";
import Image from "next/image";

import { APP_NAME, APP_SUBTITLE } from "@/lib/constants";
import { PageContainer } from "@/components/layout/page-container";

const LOGO_PUBLIC_PATH = "/brand/carrefour-property-logo.png";
const LOGO_FILE_PATH = path.join(
  process.cwd(),
  "public",
  "brand",
  "carrefour-property-logo.png",
);

/**
 * Logo Carrefour Property. Si le fichier n'est pas présent dans `public/brand`,
 * affiche un repli textuel plutôt que de faire planter la page.
 */
function BrandMark() {
  const logoExists = fs.existsSync(LOGO_FILE_PATH);

  if (!logoExists) {
    return (
      <span className="text-sm font-semibold text-neutral-700">
        Carrefour Property
      </span>
    );
  }

  return (
    <Image
      src={LOGO_PUBLIC_PATH}
      alt="Carrefour Property"
      width={40}
      height={40}
      className="h-10 w-10 object-contain"
      priority
    />
  );
}

/**
 * En-tête de l'application : logo Carrefour Property, nom et sous-titre de
 * Merlin à gauche, emplacement réservé au menu utilisateur à droite (étape 3).
 */
export function Header() {
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
        {/* Emplacement réservé au menu utilisateur (étape 3) */}
        <div aria-hidden="true" />
      </PageContainer>
    </header>
  );
}
