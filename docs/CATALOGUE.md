# Catalogue des applications (étape 4)

La page d'accueil (`/`) affiche le catalogue des applications visibles sous forme de cartes. Elle est réservée aux utilisateurs connectés (`requireUser()`), admin compris : `AppRepository.listVisible()` est utilisé pour **tous**. La gestion des apps masquées se fera sous `/admin` (étape 5).

## Chaîne de données

`src/lib/catalogue/data.ts` (`loadCatalogue()`, serveur uniquement) → `getUserRepositories().apps.listVisible()` (RLS appliquée) → tri `sortOrder` puis nom (ordre français) → **view models** (`AppCardModel`, `src/lib/catalogue/view-model.ts`) envoyés au composant client `CatalogueView`.

- Un view model est un objet simple et sérialisable limité à ce qui est affiché : ni `sortOrder`, ni `isHidden`, ni identifiants superflus. Les liens y sont déjà validés.
- Défense en profondeur : même si le repository renvoyait une app masquée, `loadCatalogue()` l'écarte. Aucune donnée d'une app masquée n'atteint le HTML ni la charge RSC (vérifié par un test e2e).
- Une erreur de lecture devient une `CatalogueLoadError` générique (aucun détail interne) ; `src/app/(app)/(home)/error.tsx` affiche un message en français et un bouton « Réessayer ». `loading.tsx` affiche des squelettes.
- Les dates relatives sont calculées **côté serveur** (`now` injectable) : aucun `Date.now()` dans un composant client (hydratation).

## Fiche d'une application et rendu

| Champ                      | Rendu sur la carte                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------- |
| `icon`                     | Icône du registre (repli `app-window` si inconnue)                                                  |
| `name`                     | Titre `h2`                                                                                          |
| `category`                 | Texte sous le titre ; sert au filtre par catégorie                                                  |
| `description`              | Paragraphe                                                                                          |
| `status`                   | Badge « En ligne » / « Hors ligne » / « Maintenance » (texte **et** icône, jamais la couleur seule) |
| `statusMessage`            | Encadré visible sur la carte (pas seulement au survol)                                              |
| `statusUpdatedAt`          | « mis à jour il y a 2 h », « hier », « à l'instant »…                                               |
| `version`                  | « Version x.y.z »                                                                                   |
| `isNew`                    | Badge « Nouveau »                                                                                   |
| `url`                      | Bouton « Ouvrir » (nouvel onglet) ; sinon « Bientôt disponible »                                    |
| `docUrl`                   | Lien secondaire « Documentation » (nouvel onglet)                                                   |
| `ownerName` / `ownerEmail` | « Responsable : … » ; lien « Contacter » (`mailto:`) si l'email est valide                          |

## Statuts : saisis à la main, jamais bloquants

Le statut est **saisi à la main** par un administrateur (aucun health check automatique en V1) ; il peut donc être périmé. Il n'empêche **jamais** d'ouvrir une application : une app hors ligne ou en maintenance qui a une URL garde son bouton « Ouvrir », et son statut ainsi que son message restent bien visibles sur la carte.

## « Bientôt disponible »

Une app sans URL, ou dont l'URL n'a pas le protocole `http:`/`https:` (`safeExternalUrl`, `src/lib/catalogue/external-url.ts`), affiche un bouton désactivé « Bientôt disponible » : aucun lien, non focalisable. Tous les liens externes utilisent `target="_blank"` et `rel="noopener noreferrer"`. Un lien « Contacter » n'est construit que depuis un email valide (`safeEmail`). Aucun HTML brut n'est injecté depuis les données.

## Registre d'icônes

`src/lib/catalogue/icons.ts` : registre **explicite** d'une cinquantaine d'icônes `lucide-react` (clé = nom lucide en kebab-case), plutôt que d'importer toute la bibliothèque. `ICON_NAMES` (liste triée, sans doublon) servira de liste de choix au formulaire d'administration (étape 5). `resolveIcon(name)` retombe sur `app-window` pour un nom inconnu, vide ou absent, sans erreur.

Ajouter une icône : importer le composant depuis `lucide-react` dans `icons.ts`, ajouter l'entrée `"nom-kebab": Composant` au registre. Le test `icons.test.ts` vérifie l'absence de doublon.

## Recherche, filtre et URL

- Filtrage **côté client** sur la liste déjà chargée (quelques dizaines d'apps au plus), via `src/lib/catalogue/filter.ts`.
- Recherche dans nom, description et catégorie, insensible à la casse **et aux accents** (« entrepots » trouve « Outil entrepôts »). Filtre de catégorie : « Toutes » + une puce par catégorie présente, triées alphabétiquement ; les deux se combinent.
- État reflété dans l'URL : `?q=…&cat=…` (mis à jour par `history.replaceState`, sans rechargement ni saut de scroll). Paramètres validés côté serveur (`parseCatalogueParams`) : catégorie inconnue → « Toutes », `q` limité à 100 caractères, caractères de contrôle retirés.
- Compteur « N application(s) » dans une zone `aria-live="polite"`. États vides : « Aucune application disponible pour le moment. » (catalogue vide) ; message + « Réinitialiser les filtres » (aucun résultat).
- Un emplacement (`data-slot="announcements"`) est réservé au-dessus du catalogue pour les annonces (étape 7).

## Jeu de démonstration en mémoire (dev / e2e)

Avec `DATA_PROVIDER=memory` (jamais en production), le store mémoire est pré-rempli (`src/lib/data/providers/memory/demo-apps.ts`, appliqué dans `getMemoryRepositories()`), avec des URL en `https://example.test/...` et des dates relatives au démarrage :

1. **Outil entrepôts** — Entrepôts, en ligne, `0.1.0`, « Nouveau », responsable « Équipe projet », documentation.
2. **Comptes rendus de visites** — Entrepôts, en ligne, `1.0.0`.
3. **Suivi des contrôles réglementaires** — Réglementaire, sans URL, hors ligne.
4. **Annuaire des sites** — Référentiel, maintenance (« Mise à jour en cours, retour prévu à 18 h »).
5. **Tableau de bord interne** — Référentiel, hors ligne avec message, URL présente.
6. **App masquée de test** — masquée : n'apparaît jamais sur l'accueil.

## Sécurité des routes

Toute nouvelle route de premier niveau protégée doit être ajoutée à `PROTECTED_PATH_PREFIXES` (`src/lib/auth/constants.ts`). Le test `src/lib/auth/protected-paths.test.ts` parcourt `src/app/(app)` (groupes de routes traversés) et échoue, avec la liste à compléter, si un segment n'est pas couvert. Le middleware n'est qu'un confort : chaque page appelle `requireUser()`/`requireAdmin()`.
