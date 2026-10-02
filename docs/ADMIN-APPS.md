# Administration des applications (étape 5)

L'administration du catalogue vit sous `/admin` (réservée aux admins **en vue admin**). Elle permet de créer, modifier, ordonner, masquer/afficher, changer le statut et supprimer les applications ; chaque modification se répercute sur l'accueil des utilisateurs.

## Écrans

| Route              | Contenu                                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`           | Tableau de bord : tuiles (total / visibles / masquées, répartition par statut, apps sans URL), 10 derniers changements de statut (nom de l'app avec lien vers sa fiche, ancien → nouveau statut, note, auteur, date), raccourci « Ajouter une application ».                      |
| `/admin/apps`      | Liste de **toutes** les apps (masquées incluses, étiquette « Masquée »), triées par `sortOrder` puis nom. Par ligne : monter / descendre, masquer / afficher, « Gérer ». Le tableau défile dans son propre conteneur sur petit écran. Retours dans une zone `aria-live="polite"`. |
| `/admin/apps/new`  | Création, avec aperçu en direct de la carte (composant `AppCard`, non cliquable).                                                                                                                                                                                                 |
| `/admin/apps/[id]` | Fiche : Informations (formulaire + aperçu), Statut, Journal des changements de statut (50 derniers), Zone dangereuse (suppression). Un id mal formé ou inconnu affiche « Application introuvable » avec un lien vers la liste (pas d'erreur 500).                                 |

## Règles

- **Slug** : généré à la création depuis le nom (minuscules, sans accents, tirets ; `slugify`), modifiable avant l'enregistrement, puis **immuable** (lecture seule ensuite, jamais envoyé au repository en modification) pour ne pas casser de futurs liens.
- **Validation** : uniquement par les schémas zod existants de `src/lib/data/schemas.ts` (`createAppInputSchema`, `updateAppInputSchema`, `setAppStatusInputSchema`), composés par `src/lib/admin/apps/form.ts`. URL et lien de documentation en `http:`/`https:` uniquement. Les erreurs sont affichées par champ (`aria-describedby`) ; un slug en doublon (`ConflictError`) s'affiche sur le champ slug ; les autres erreurs de repository donnent un message générique sans détail interne.
- **Statut manuel et non bloquant** : le statut est saisi à la main (note ≤ 300 caractères, affichée sur la carte). Il n'empêche jamais d'ouvrir l'application. Choisir le statut actuel ne met à jour que le message et ne crée **aucun** événement : l'interface indique « Statut inchangé : seul le message sera mis à jour ». À la création, le statut initial par défaut est « Hors ligne ».
- **Ordre** : « Monter » / « Descendre » n'envoient au serveur que l'id et la direction. Le serveur relit `listAll()`, échange l'app avec son voisin (sans effet aux extrémités) et appelle `reorder(orderedIds)` avec l'ordre complet : l'ordre n'est jamais calculé côté client. Pas de glisser-déposer.
- **Suppression** : irréversible (le journal de statut est supprimé en cascade). Exige la saisie du nom exact, revérifiée côté serveur ; le bouton reste désactivé tant que le nom ne correspond pas. Pour retirer une app de l'accueil sans la perdre, la masquer.
- **Modification** : seuls les champs modifiés sont envoyés au repository et journalisés.
- **Concurrence** : **dernière écriture gagnante** (pas de verrou optimiste en V1). Si l'app a été supprimée entre-temps, l'action redirige vers `/admin/apps?notice=gone` (« Cette application n'existe plus. »).

## Modèle d'autorisation

`requireAdmin()` (rôle admin lu en base **et** vue admin, sinon redirection vers `/`) est appelé :

1. dans `admin/layout.tsx`,
2. dans **chaque** `page.tsx` d'administration,
3. en **première instruction de chaque server action** (`src/app/(app)/admin/apps/actions.ts`).

**Un layout n'est pas réexécuté à chaque navigation : il ne protège jamais seul.** Les actions utilisent `getAdminRepositories()` (service role) uniquement après `requireAdmin()` ; l'identité de l'acteur (`changedBy`, journal) vient de la session serveur, jamais du formulaire. Les chargeurs de données (`src/lib/admin/apps/data.ts`) utilisent aussi le service role et ne s'appellent qu'après `requireAdmin()` dans une page. Les tests `admin-guards.test.ts` (analyse statique : layout, pages et actions) et `actions.test.ts` (chaque action refuse un non-connecté, un utilisateur simple — avec ou sans cookie `merlin_view` forgé — et un admin en vue utilisateur, sans aucune mutation) verrouillent cette règle.

## Actions du journal d'activité

Toutes via `ActivityLogRepository.record` (jamais bloquant), avec `actorId`/`actorEmail` de l'admin, `entity_type = "app"` et `entity_id` = id de l'app. Aucune valeur de champ ni donnée sensible dans les métadonnées.

| Action                     | Métadonnées                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `app.created`              | `name`, `slug`                                                                                       |
| `app.updated`              | `fields` : **noms** des champs modifiés (ou `["statusMessage"]` si seul le message de statut change) |
| `app.deleted`              | `name`, `slug`                                                                                       |
| `app.hidden` / `app.shown` | —                                                                                                    |
| `app.moved`                | `direction` (`up` / `down`)                                                                          |
| `app.status_changed`       | `from`, `to`                                                                                         |

Après chaque mutation : `revalidatePath("/")` et les chemins d'administration concernés (les pages restent dynamiques, sans cache partagé).

## Ajouter une section d'administration

1. Créer la route sous `src/app/(app)/admin/<section>/` (le préfixe `/admin` est déjà dans `PROTECTED_PATH_PREFIXES`).
2. Ajouter une entrée à `ADMIN_SECTIONS` dans `src/components/admin/admin-nav.tsx` (le lien actif reçoit `aria-current="page"`).
3. Appeler `await requireAdmin()` dans **chaque** page et **chaque** server action de la section (le test statique `admin-guards.test.ts` le vérifie pour les `layout.tsx`, `page.tsx` et `actions.ts`).
4. Ne jamais appeler `getAdminRepositories()` dans un composant ni avant `requireAdmin()`.

## Stratégie e2e

- Lecture seule (`e2e/admin.spec.ts`) : tableau de bord, liste, sous-navigation, formulaire, fiche, contrôle d'accès (non connecté, utilisateur, admin en vue utilisateur, cookie `merlin_view` forgé) — sur les 3 viewports, dans les projets habituels.
- Mutations (`e2e/mutations.spec.ts`) : projet Playwright **`mutations`**, desktop uniquement, en série (`fullyParallel: false`, un seul fichier), avec `dependencies` sur `mobile`, `tablet` et `desktop` pour ne démarrer qu'**après** eux (les tests du catalogue attendent exactement 5 cartes). Playwright n'a pas d'option `workers` par projet : la sérialisation vient de `fullyParallel: false` et de `test.describe.configure({ mode: "serial" })`.
- Isolation : chaque test crée ses apps avec un nom unique et les supprime dans `afterEach` (par l'interface), même en cas d'échec ; un dernier test vérifie que l'état initial (5 apps visibles dans l'ordre d'origine, 6 dans l'administration) est rétabli. Les 6 apps de démonstration ne sont jamais modifiées.
