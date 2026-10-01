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
npm run test:e2e    # tests Playwright (build + start automatiques)
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

_Mettre à jour cette liste à la fin de chaque étape._
