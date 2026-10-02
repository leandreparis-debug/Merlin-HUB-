import type { Announcement } from "@/lib/data/types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Annonces de démonstration du store mémoire (dev/e2e uniquement, jamais en
 * production). Dates relatives à `now` pour des libellés stables : une
 * annonce épinglée, deux annonces publiées à des dates différentes et un
 * brouillon qui ne doit jamais être visible d'un utilisateur.
 */
export function createDemoAnnouncements(
  now: Date = new Date(),
): Announcement[] {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  const base = {
    createdBy: null,
  } satisfies Partial<Announcement>;

  return [
    {
      ...base,
      id: "00000000-0000-4000-8000-0000000000a1",
      title: "Bienvenue sur Merlin",
      body: "Merlin regroupe les applications internes de Carrefour Property au même endroit.\nRetrouvez-les dans le catalogue ci-dessous et signalez-nous toute difficulté.",
      isPinned: true,
      isPublished: true,
      publishedAt: ago(10 * DAY),
      createdAt: ago(10 * DAY),
      updatedAt: ago(10 * DAY),
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-0000000000a2",
      title: "Maintenance planifiée de l'outil entrepôts",
      body: "L'outil entrepôts sera indisponible samedi matin pour une opération de maintenance. Merci de prévoir vos saisies en amont.",
      isPinned: false,
      isPublished: true,
      publishedAt: ago(2 * DAY),
      createdAt: ago(2 * DAY),
      updatedAt: ago(2 * DAY),
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-0000000000a3",
      title: "Nouvelle version du suivi des baux",
      body: "Le suivi des baux propose désormais un export des échéances.",
      isPinned: false,
      isPublished: true,
      publishedAt: ago(5 * HOUR),
      createdAt: ago(5 * HOUR),
      updatedAt: ago(5 * HOUR),
    },
    {
      ...base,
      id: "00000000-0000-4000-8000-0000000000a4",
      title: "Brouillon de test",
      body: "Texte confidentiel de brouillon : ne doit jamais apparaître côté utilisateur.",
      isPinned: false,
      isPublished: false,
      publishedAt: null,
      createdAt: ago(HOUR),
      updatedAt: ago(HOUR),
    },
  ];
}
