import packageJson from "../../../package.json";
import { PageContainer } from "@/components/layout/page-container";

/** Pied de page sobre : mention légale, année dynamique et numéro de version. */
export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-border bg-card border-t">
      <PageContainer className="text-muted-foreground flex flex-col items-center justify-between gap-2 py-6 text-sm sm:flex-row">
        <p>Merlin · Outils internes Carrefour Property © {year}</p>
        <p aria-label="Version de l'application">v{packageJson.version}</p>
      </PageContainer>
    </footer>
  );
}
