# Merlin — repères pour Claude Code

## Objectif

Merlin est le hub web interne de Carrefour Property : page d'entrée protégée (identifiant professionnel + mot de passe) qui regroupe sous forme de cartes les applications internes Carrefour Property. Interface en français, code en anglais, **mode clair uniquement** (pas de `dark:`, pas de bascule de thème).

## Stack

- Next.js 15 (App Router), React 19, TypeScript strict (`strict: true` + `noUncheckedIndexedAccess`)
- Tailwind CSS v4, configuration CSS-first (tokens dans `@theme`, fichier `src/app/globals.css`, pas de `tailwind.config.js`)
- Composants shadcn/ui adaptés aux tokens de marque (voir `src/components/ui/`)
- ESLint (config Next + TypeScript + Prettier), Prettier (`prettier-plugin-tailwindcss`)
- Vitest + React Testing Library (tests unitaires), Playwright (tests e2e)
- Dossier source `src/`, alias d'import `@/*`
- Données (étape 2) : Supabase (Postgres + Auth) en V1, migrations SQL dans `supabase/migrations/`, RLS activée partout, deux implémentations de repository (`src/lib/data/providers/supabase`, `src/lib/data/providers/memory`)

## Commandes utiles

```bash
npm run dev        # serveur de développement
npm run check       # lint + format:check + typecheck + test (à lancer avant de considérer une tâche terminée)
npm run test:e2e    # tests Playwright (démarre next dev en DATA_PROVIDER=memory sur le port 3100)
npm run build       # build de production
npm run db:bundle            # concatène les migrations SQL (supabase/all-in-one.sql)
npm run db:bootstrap-admin   # crée le premier compte administrateur
DATA_PROVIDER=memory npm run dev   # développer sans Supabase (jamais en production)
```

## Conventions

- Fichiers en kebab-case, composants/types en PascalCase, constantes en SCREAMING_SNAKE_CASE.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`…), un commit par changement logique.
- JSDoc courte sur les fonctions et composants exportés (une ligne si possible, pas de blocs multi-paragraphes).

## Règle d'abstraction données / authentification

**Aucun accès direct à la base de données ou au fournisseur d'authentification en dehors de `src/lib/data`, `src/lib/supabase` et `src/lib/auth`.** Toujours passer par les repositories (`getUserRepositories()` / `getAdminRepositories()` dans `src/lib/data/index.ts`) ou par le service d'auth. Imposé par ESLint (`no-restricted-imports` sur `@supabase/*`, dérogation pour ces dossiers, `scripts/` et les tests). Cette règle permet la migration V1 (Vercel + Supabase) → V2 (serveur interne Carrefour Property, SQL Server, SSO) sans réécrire le reste de l'application. Détails dans `docs/ARCHITECTURE.md` et `docs/DATA-MODEL.md`.

## Règle d'autorisation (étape 3)

**Toute nouvelle page ou server action protégée appelle `requireUser()` (ou `requireAdmin()` pour l'administration) côté serveur.** Le middleware ne sert qu'au confort (refresh de session, redirection UX) et ne remplace jamais ce contrôle. Rôle, `isActive` et `mustChangePassword` se lisent dans `profiles`, jamais dans le JWT. L'identité se vérifie avec `getUser()`, jamais `getSession()`. La vue admin/utilisateur (cookie `merlin_view`) est cosmétique : elle ne donne aucun droit. Détails : `docs/AUTH.md`. **Toute nouvelle route de premier niveau protégée doit être ajoutée à `PROTECTED_PATH_PREFIXES`** (`src/lib/auth/constants.ts`) : le test `src/lib/auth/protected-paths.test.ts` parcourt `src/app/(app)` et échoue si un segment n'est pas couvert.

## Administration (étape 5)

**Toute nouvelle page ou server action d'administration appelle `requireAdmin()` elle-même** (un layout n'est pas réexécuté à chaque navigation et ne protège jamais seul), avant tout accès à `getAdminRepositories()`. L'acteur vient de la session, jamais du formulaire. Nouvelle section = route sous `src/app/(app)/admin/` + entrée dans `ADMIN_SECTIONS` (`src/components/admin/admin-nav.tsx`). Les tests e2e qui modifient des données vont dans `e2e/mutations.spec.ts` (projet `mutations`, nettoyage garanti). Détails : `docs/ADMIN-APPS.md`.

## Gestion des comptes (étape 6)

`AccountAdminService` (`getAccountAdminService()`) est la **seule voie de gestion des comptes Auth** : à n'appeler qu'après `requireAdmin()`. Le mot de passe provisoire n'est **jamais** stocké, journalisé, placé dans une URL ni renvoyé par un GET : il n'existe que dans le résultat d'une server action, affiché une seule fois. Les règles `src/lib/admin/users/user-rules.ts` sont revérifiées côté serveur (cible et `countActiveAdmins()` relus). Toute page ou action admin appelle `requireAdmin()` elle-même. Détails : `docs/ADMIN-USERS.md`.

## Catalogue (étape 4)

Les composants client du catalogue ne reçoivent que des view models sérialisables (`src/lib/catalogue/view-model.ts`), jamais un repository ni un `App` brut. Liens externes : toujours via `safeExternalUrl` (`http:`/`https:` uniquement), `target="_blank"` + `rel="noopener noreferrer"`. Icônes : registre explicite `src/lib/catalogue/icons.ts` (pas d'import global de `lucide-react`). Détails : `docs/CATALOGUE.md`.

## Rappels

- Mode clair uniquement, UI en français, code et noms techniques en anglais.
- Site non indexable (`noindex`, `robots.txt` qui interdit tout) : Merlin est un outil interne.
- Couleur de marque centralisée dans `src/app/globals.css` (`--brand-600`, commentaire en tête de fichier).
- Si la CLI shadcn/ui n'est pas accessible (réseau sortant bloqué vers `ui.shadcn.com`), adapter les composants à la main à partir du code source officiel (shadcn-ui/ui sur GitHub), en retirant les variantes `dark:` (mode clair uniquement) — c'est ce qui a été fait à l'étape 1.
- `getAdminRepositories()` contourne la RLS (service role) : ne l'utiliser côté serveur qu'après avoir vérifié le rôle admin de l'utilisateur courant dans le code appelant.
- `DATA_PROVIDER=memory` ne doit jamais être utilisé en production (garde-fou dans `src/lib/data/index.ts`).

## Étapes terminées

- ✅ **Étape 1** — Initialisation du projet : Next.js 15 + outillage (ESLint, Prettier, Vitest, Playwright), structure de dossiers, design system (tokens Tailwind v4, composants shadcn/ui adaptés), layout responsive (header, footer, conteneur), page d'accueil provisoire, route `/api/health`, `robots.ts`, documentation de base.
- ✅ **Étape 2** — Base de données et couche d'abstraction : migrations SQL (schéma, RLS, fonctions `set_app_status`/`reorder_apps`), types de domaine et schémas zod, interfaces de repository, implémentations Supabase et mémoire, fabrique (`getUserRepositories`/`getAdminRepositories`), règle ESLint de frontière, scripts (`db:bootstrap-admin`, `db:bundle`), seed de développement, tests (contrats, mappers, traduction d'erreurs, validation PGlite), `docs/DATA-MODEL.md` et `docs/SUPABASE-SETUP.md`. Les repositories `AnnouncementRepository` et `ReportRepository` ne sont que des interfaces à ce stade (implémentations aux étapes 7 et 8).

- ✅ **Étape 3** — Authentification : `AuthService` (implémentations Supabase et mémoire), connexion/déconnexion, changement de mot de passe forcé, politique de mot de passe, `requireUser`/`requireAdmin`, middleware, rôles, bascule vue admin/utilisateur, menu utilisateur, page `/admin` provisoire, journal d'authentification, e2e (serveur `next dev` en mode mémoire), `docs/AUTH.md`.
- ✅ **Étape 4** — Page d'accueil et catalogue : `loadCatalogue()` (view models sérialisables, `listVisible()` pour tous), cartes d'applications (statut, « Nouveau », « Bientôt disponible », liens externes validés), recherche insensible aux accents et filtre par catégorie reflétés dans l'URL, registre d'icônes `lucide-react`, apps de démonstration en mémoire, garde-fou `PROTECTED_PATH_PREFIXES`, `docs/CATALOGUE.md`.
- ✅ **Étape 5** — Administration des applications : `/admin` (tableau de bord, liste, création/édition avec aperçu, ordre, masquage, statut + journal, suppression confirmée), actions serveur gardées par `requireAdmin()`, journal `app.*`, projet e2e `mutations`, `docs/ADMIN-APPS.md`.
- ✅ **Étape 6** — Administration des utilisateurs : `/admin/users` (liste, création avec mot de passe provisoire affiché une seule fois, réinitialisation, rôle, désactivation / réactivation), `AccountAdminService` (Supabase et mémoire, compensation), règles `user-rules` (pas d'auto-sabotage, dernier admin actif), `ALLOWED_EMAIL_DOMAINS`, journal `user.*`, `docs/ADMIN-USERS.md`.
- ⏭️ **Étape 7** — Annonces.

_Mettre à jour cette liste à la fin de chaque étape._
