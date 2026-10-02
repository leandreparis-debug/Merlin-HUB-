# Annonces épinglables (étape 7)

Un administrateur publie des annonces en **texte brut** ; les utilisateurs les lisent dans la zone « Annonces » de l'accueil et sur `/announcements`. Un brouillon n'est jamais visible d'un utilisateur, ni dans le HTML ni dans le flux RSC.

## Règles produit

- **Texte brut uniquement** : ni HTML, ni Markdown, ni lien automatique. Les retours à la ligne sont conservés (`white-space: pre-line`). Le texte est rogné, les fins de ligne normalisées, les caractères de contrôle (hors `\n` et tabulation) retirés ; un titre ou un texte vide ou fait d'espaces est refusé. Titre 1–120, texte 1–2000 caractères (schémas dans `src/lib/data/schemas.ts`, mêmes bornes que les `CHECK` SQL).
- **Tri** : épinglées d'abord, puis `publishedAt` décroissant, puis `createdAt` décroissant.
- **Date de publication** : `publishedAt` est posée à la **première** publication (création en « publiée » ou passage brouillon → publiée) et ne change plus : ni par une modification du texte, ni par l'épinglage, ni par un cycle dépublier / republier. Un brouillon jamais publié a `publishedAt = null`.
- **Accueil** : au plus 3 annonces épinglées, complétées par les plus récentes non épinglées, 5 au total ; lien « Toutes les annonces » si d'autres existent. Sans annonce publiée, la zone n'est pas rendue. Si seule la lecture des annonces échoue, un message discret remplace la zone et le catalogue reste affiché.
- **`/announcements`** : toutes les annonces publiées (100 au plus, avec une note explicite si la limite est atteinte), dates absolues (Europe/Paris) et relatives, texte complet. Texte de plus de 280 caractères : suite repliée dans un `<details>` natif (« Lire la suite »).

## Écrans

| Écran                                                                          | Route                       | Garde                                       |
| ------------------------------------------------------------------------------ | --------------------------- | ------------------------------------------- |
| Zone d'accueil                                                                 | `/`                         | `requireUser()`                             |
| Toutes les annonces                                                            | `/announcements`            | `requireUser()` + `PROTECTED_PATH_PREFIXES` |
| Liste d'administration (brouillons compris, recherche, actions rapides)        | `/admin/announcements`      | `requireAdmin()`                            |
| Création (compteur, aperçu en direct, « Épingler », « Publier immédiatement ») | `/admin/announcements/new`  | `requireAdmin()`                            |
| Fiche (contenu, état de publication, zone de suppression)                      | `/admin/announcements/[id]` | `requireAdmin()`                            |

Le tableau de bord d'administration affiche trois tuiles (publiées, épinglées, brouillons). Épingler au-delà de 3 annonces épinglées publiées affiche un avertissement non bloquant.

## Modèle d'autorisation (défense en profondeur)

1. **Layout** `(app)` : `requireUser()`.
2. **Page** : chaque page d'administration appelle `requireAdmin()` elle-même.
3. **Server action** : `requireAdmin()` est la première instruction de chacune des 5 actions (`createAnnouncementAction`, `updateAnnouncementAction`, `setAnnouncementPinnedAction`, `setAnnouncementPublishedAction`, `deleteAnnouncementAction`) ; l'acteur vient de la session. Le test statique `admin-guards.test.ts` le vérifie et échoue sur une action sans garde.
4. **RLS** : `announcements` n'est lisible que par un utilisateur actif (publiées, ou toutes pour un admin) ; toute écriture est réservée aux admins. Les lectures utilisateur passent par `getUserRepositories()` (RLS), les écritures d'administration par `getAdminRepositories()` après `requireAdmin()`.
5. **Données exposées** : le module `src/lib/announcements/data.ts` ne renvoie que des view models (`id`, titre, texte, date, indicateur d'épinglage) — jamais `isPublished` ni `createdBy` — et écarte toute annonce non publiée renvoyée par le repository.

Les actions épinglage / publication prennent une **valeur explicite** (idempotentes, pas de bascule). Une annonce supprimée entre-temps redirige vers la liste avec « Cette annonce n'existe plus. ».

## Migration

`supabase/migrations/20261001000700_announcements_published_at.sql` (additive) rend `published_at` nullable, ajoute la contrainte « publiée ⇒ date » et un trigger qui pose la date à la première publication sans jamais l'écraser. La migration `…0400_announcements.sql` n'est pas modifiée. Voir `docs/DATA-MODEL.md`.

## Journal d'activité

`entity_type = "announcement"`, `entity_id` = identifiant de l'annonce, acteur issu de la session : `announcement.created`, `.updated` (noms de champs uniquement), `.published`, `.unpublished`, `.pinned`, `.unpinned`, `.deleted`. Le titre et le texte ne sont **jamais** copiés dans les métadonnées. Aucune entrée n'est écrite si l'état demandé est déjà le bon.

## Données de démonstration (mémoire, hors production)

Quatre annonces : « Bienvenue sur Merlin » (épinglée), deux annonces publiées à des dates différentes et « Brouillon de test » (jamais visible d'un utilisateur). Dates relatives à l'heure de démarrage.

## Tests

Contrat de repository (mémoire, et Supabase en suite d'intégration facultative), schémas, view models, chargeurs, actions (matrice de refus : non connecté, utilisateur, cookie `merlin_view` forgé, admin en vue utilisateur), composants, migration statique et PGlite (trigger, RLS, compte désactivé), e2e en lecture seule, de sécurité et de mutations (`e2e/announcements*.spec.ts`).

## Limites et pistes V2

Pas d'expiration automatique, de planification de publication, de lecture « non lue », de pièces jointes ni de ciblage par groupe. En V2 (SQL Server, SSO) : même interface `AnnouncementRepository`, trigger `published_at` à réécrire côté SQL Server (ou dans le repository).
