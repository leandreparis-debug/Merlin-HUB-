# Architecture

## Principes clés

### Couche d'abstraction données et authentification

Merlin migrera à terme vers une infrastructure différente de celle de son lancement (voir [Trajectoire V1 → V2](#trajectoire-v1--v2)). Pour que cette migration ne nécessite pas de réécrire l'application, deux règles strictes s'appliquent dès l'étape 1 :

- **Aucun accès direct à une base de données en dehors de `src/lib/data`.** Toute lecture ou écriture passe par un repository exposé depuis ce dossier (voir `src/lib/data/README.md`).
- **Aucun accès direct à un fournisseur d'authentification en dehors de `src/lib/auth`.** Toute vérification de session, de rôle ou d'identité passe par le service exposé depuis ce dossier (voir `src/lib/auth/README.md`).

Les composants, pages et routes API ne connaissent que les fonctions typées exposées par ces deux dossiers, jamais les détails d'implémentation (client Supabase, requêtes SQL, SDK d'authentification).

Cette règle est imposée par ESLint (`no-restricted-imports` sur `@supabase/*`, dans `eslint.config.mjs`), avec dérogation pour `src/lib/data`, `src/lib/supabase`, `scripts/` et les fichiers de test.

### Couche de données (étape 2)

`src/lib/data/` expose :

- **`types.ts`** : types de domaine purs (camelCase, dates en ISO 8601), sans dépendance Supabase.
- **`schemas.ts`** : schémas zod pour toute entrée d'écriture, reprenant les contraintes SQL (longueurs, formats).
- **`errors.ts`** : erreurs communes aux deux implémentations (`NotFoundError`, `ConflictError`, `ValidationError`, `UnexpectedRepositoryError`, `NotImplementedError`), sans fuite de détail interne.
- **`repositories/`** : interfaces (`ProfileRepository`, `AppRepository`, `AnnouncementRepository`, `ReportRepository`, `ActivityLogRepository`) regroupées dans le type `Repositories`.
- **`providers/supabase/`** et **`providers/memory/`** : deux implémentations de ces interfaces — Supabase (V1) et un store en mémoire isolé par instance (développement sans Supabase, `DATA_PROVIDER=memory`, jamais en production).
- **`index.ts`** : fabrique — `getUserRepositories()` (RLS appliquée, client basé sur la session) et `getAdminRepositories()` (service role, contourne la RLS, réservé aux opérations serveur après vérification du rôle admin dans le code appelant).

`src/lib/supabase/` expose les deux clients bas niveau (`admin.ts` avec la clé service role, `server.ts` basé sur la session utilisateur via `@supabase/ssr`), tous deux `import "server-only"`. Détail du schéma SQL, de la matrice RLS et des fonctions : `docs/DATA-MODEL.md`. Mise en route d'un projet Supabase : `docs/SUPABASE-SETUP.md`.

### Authentification et rôles (étape 3)

- `src/lib/auth` expose `AuthService` (interface), `getAuthService()` (fabrique selon `DATA_PROVIDER` : Supabase ou mémoire), `getCurrentUser()`, `requireUser()`, `requireAdmin()`, `getViewMode()`. Le rôle et l'état du compte sont lus dans `profiles` à chaque requête ; l'identité est vérifiée par le serveur d'authentification (`getUser()`).
- Routes : groupe `(public)` (`/login`), groupe `(app)` (layout protégé par `requireUser()`, accueil, `/change-password`, `/admin`). `/api/health`, `robots.txt` et la 404 restent publics.
- Le middleware (`src/middleware.ts`) ne fait que rafraîchir la session et rediriger les non-connectés (UX) ; **l'autorisation réelle est refaite côté serveur**. Toute nouvelle page ou action protégée appelle `requireUser()` ou `requireAdmin()`.
- Détails, modèle de sécurité et notes de migration SSO : `docs/AUTH.md`.

### Catalogue (étape 4)

- `src/app/(app)/(home)/page.tsx` : accueil protégé ; `src/lib/catalogue/data.ts` lit `listVisible()` via `getUserRepositories()` (RLS) et produit des view models sérialisables (`src/lib/catalogue/view-model.ts`) ; `CatalogueView` (composant client) filtre la liste déjà chargée et reflète `?q=`/`?cat=` dans l'URL.
- Registre d'icônes explicite (`src/lib/catalogue/icons.ts`), liens externes validés (`external-url.ts`), dates relatives calculées côté serveur (`status.ts`).
- Garde-fou : tout nouveau segment de premier niveau de `src/app/(app)` doit figurer dans `PROTECTED_PATH_PREFIXES` (test `protected-paths.test.ts`).
- Détails : `docs/CATALOGUE.md`.

### Administration des applications (étape 5)

- `src/app/(app)/admin/` : layout (titre + sous-navigation), tableau de bord, liste, création, fiche. `requireAdmin()` est appelé dans le layout, dans chaque page et en première instruction de chaque server action (`apps/actions.ts`) : un layout ne protège jamais seul.
- `src/lib/admin/apps/` : `form.ts` (composition des schémas zod existants), `slugify.ts`, `view-models.ts` (sérialisables, dates relatives et absolues Europe/Paris), `data.ts` (chargeurs service role, après `requireAdmin()`), `audit.ts` (journal `app.*`).
- Aucune donnée d'administration n'est lue par un composant : seuls des view models sont transmis aux composants client (`src/components/admin/`).
- Détails, règles et stratégie e2e : `docs/ADMIN-APPS.md`.

### Administration des utilisateurs (étape 6)

- `src/app/(app)/admin/users/` : liste, création, fiche et server actions, chacune gardée par `requireAdmin()` (layout, pages et actions).
- `AccountAdminService` (`src/lib/auth/account-admin.ts`, fabrique `getAccountAdminService()`, implémentations Supabase et mémoire) est la **seule voie de gestion des comptes Auth** ; le mot de passe provisoire (`src/lib/auth/provisional-password.ts`) n'est jamais stocké ni journalisé.
- `src/lib/admin/users/` : règles métier pures (`user-rules.ts`, partagées par les actions et l'interface), view models, filtres, chargeurs de données (service role, après `requireAdmin()`), journal `user.*`.
- Détails, garde-fous et notes de migration SSO : `docs/ADMIN-USERS.md`.

### Annonces (étape 7)

- `AnnouncementRepository` (`listPublished`, `listAll`, `getById`, `create`, `update`, `setPinned`, `setPublished`, `delete`), implémentations Supabase et mémoire, suite de contrat commune.
- Côté utilisateur : `src/lib/announcements/` (view models sérialisables, sélection de l'accueil, chargeurs via `getUserRepositories()`) et `src/components/announcements/`. Côté admin : `src/app/(app)/admin/announcements/` (pages et actions, `requireAdmin()` partout) et `src/lib/admin/announcements/`.
- Détails : `docs/ANNOUNCEMENTS.md`.

### Trajectoire V1 → V2

- **V1 (actuelle)** : hébergement Vercel, données et authentification via Supabase (Postgres + Supabase Auth), connexion par identifiant professionnel (email) et mot de passe.
- **V2 (cible)** : migration vers un serveur interne Carrefour Property, sur réseau fermé, conteneurisé avec Docker, base de données probablement SQL Server, authentification par SSO d'entreprise.

Grâce à la couche d'abstraction, cette migration se traduit par un changement d'implémentation interne à `src/lib/data` et `src/lib/auth`, sans modification du reste du code.

### Règles de dépendance entre dossiers

```
src/app/            → peut importer src/components, src/lib, src/types
src/components/ui/  → composants génériques, ne dépendent que de src/lib/utils et src/types
src/components/layout/ → peut importer src/components/ui, src/lib, src/types
src/lib/data/        → point d'entrée unique vers les données (aucune autre couche n'accède à la base)
src/lib/supabase/    → clients Supabase bas niveau, utilisés uniquement par src/lib/data
src/lib/auth/        → point d'entrée unique vers l'authentification (aucune autre couche n'accède au fournisseur)
src/lib/             → utilitaires sans dépendance vers src/app ou src/components
src/types/           → types partagés, aucune dépendance vers le reste de l'application
```

Aucune dépendance circulaire : `src/lib` et `src/types` ne doivent jamais importer depuis `src/app` ou `src/components`.

### Conventions de nommage

- **Fichiers** : kebab-case (`page-container.tsx`, `skip-link.tsx`).
- **Composants React** : PascalCase (`PageContainer`, `SkipLink`).
- **Types et interfaces** : PascalCase (`CurrentUser`, `AppStatus`).
- **Constantes** : SCREAMING_SNAKE_CASE (`APP_NAME`, `APP_SUBTITLE`).

### Règles de sécurité de base

- Aucun secret en dur dans le code. Les secrets vivent dans `.env.local` (non versionné) ; `.env.example` documente les clés attendues avec des valeurs factices.
- Seules les variables préfixées `NEXT_PUBLIC_` peuvent être exposées au client ; `src/lib/env.ts` sépare explicitement la lecture des variables publiques (`getPublicEnv`) et serveur (`getEnv`).
- En-têtes de sécurité HTTP définis dans `next.config.ts` (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).
- Réponses applicatives en `Cache-Control: no-store` (`next.config.ts`) ; modèle d'authentification dans `docs/AUTH.md`.
- Le site n'est pas indexable (`robots.txt` et balise meta `robots` en `noindex`) : Merlin est un outil interne, pas un site public.
- La route `/api/health` ne renvoie aucune information sensible.
