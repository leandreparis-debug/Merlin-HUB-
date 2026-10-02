import type { ReactNode } from "react";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

/** Coque des pages publiques (connexion, 404) : en-tête « non connecté », contenu principal, pied de page. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </>
  );
}
