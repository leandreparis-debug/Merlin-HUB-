import type { App } from "@/lib/data/types";

const HOUR = 60 * 60 * 1000;

/**
 * Applications de démonstration du store mémoire (dev/e2e uniquement, jamais
 * en production : le store mémoire est lui-même interdit en production). Dates
 * de statut relatives à `now` pour des libellés déterministes (« il y a 2 h »,
 * « hier »). Les URL sont toutes en `https://example.test/...`.
 */
export function createDemoApps(now: Date = new Date()): App[] {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const created = ago(30 * 24 * HOUR);

  const base = {
    icon: "app-window",
    version: null,
    isNew: false,
    ownerName: null,
    ownerEmail: null,
    docUrl: null,
    statusMessage: null,
    isHidden: false,
    createdAt: created,
    updatedAt: created,
  } satisfies Partial<App>;

  return [
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000001",
      slug: "outil-entrepots",
      name: "Outil entrepôts",
      description:
        "Pilotage de l'activité des entrepôts : surfaces, occupation et suivi des interventions.",
      icon: "warehouse",
      category: "Entrepôts",
      url: "https://example.test/outil-entrepots",
      version: "0.1.0",
      isNew: true,
      ownerName: "Équipe projet",
      ownerEmail: "equipe.projet@example.test",
      docUrl: "https://example.test/docs/outil-entrepots",
      status: "online",
      statusUpdatedAt: ago(2 * HOUR),
      sortOrder: 0,
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000002",
      slug: "comptes-rendus-visites",
      name: "Comptes rendus de visites",
      description:
        "Saisie et consultation des comptes rendus de visites de sites.",
      icon: "clipboard-list",
      category: "Entrepôts",
      url: "https://example.test/comptes-rendus-visites",
      version: "1.0.0",
      status: "online",
      statusUpdatedAt: ago(26 * HOUR),
      sortOrder: 1,
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000003",
      slug: "suivi-controles-reglementaires",
      name: "Suivi des contrôles réglementaires",
      description:
        "Échéancier et suivi des contrôles réglementaires des sites.",
      icon: "shield-check",
      category: "Réglementaire",
      url: null,
      status: "offline",
      statusUpdatedAt: ago(3 * 24 * HOUR),
      sortOrder: 2,
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000004",
      slug: "annuaire-sites",
      name: "Annuaire des sites",
      description: "Référentiel des sites, contacts et informations pratiques.",
      icon: "map-pin",
      category: "Référentiel",
      url: "https://example.test/annuaire-sites",
      status: "maintenance",
      statusMessage: "Mise à jour en cours, retour prévu à 18 h",
      statusUpdatedAt: ago(45 * 60 * 1000),
      sortOrder: 3,
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000005",
      slug: "tableau-de-bord-interne",
      name: "Tableau de bord interne",
      description: "Indicateurs de pilotage consolidés de l'activité.",
      icon: "chart-column",
      category: "Référentiel",
      url: "https://example.test/tableau-de-bord",
      status: "offline",
      statusMessage:
        "Indisponible pour le moment, les données sont en cours de chargement",
      statusUpdatedAt: ago(5 * HOUR),
      sortOrder: 4,
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-000000000006",
      slug: "app-masquee-de-test",
      name: "App masquée de test",
      description: "Ne doit jamais apparaître sur l'accueil.",
      category: "Test",
      url: "https://example.test/masquee",
      status: "online",
      statusUpdatedAt: ago(HOUR),
      sortOrder: 5,
      isHidden: true,
    },
  ];
}
