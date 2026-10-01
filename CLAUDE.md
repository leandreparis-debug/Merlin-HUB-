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

## Commandes utiles

```bash
npm run dev        # serveur de développement
npm run check       # lint + format:check + typecheck + test (à lancer avant de considérer une tâche terminée)
npm run test:e2e    # tests Playwright (build + start automatiques)
npm run build       # build de production
```

## Conventions

- Fichiers en kebab-case, composants/types en PascalCase, constantes en SCREAMING_SNAKE_CASE.
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`…), un commit par changement logique.
- JSDoc courte sur les fonctions et composants exportés (une ligne si possible, pas de blocs multi-paragraphes).

## Règle d'abstraction données / authentification

**Aucun accès direct à la base de données ou au fournisseur d'authentification en dehors de `src/lib/data` et `src/lib/auth`.** Toujours passer par les repositories / le service d'auth exposés par ces dossiers (voir leurs `README.md`). Cette règle permet la migration V1 (Vercel + Supabase) → V2 (serveur interne Carrefour Property, SQL Server, SSO) sans réécrire le reste de l'application. Détails dans `docs/ARCHITECTURE.md`.

## Rappels

- Mode clair uniquement, UI en français, code et noms techniques en anglais.
- Site non indexable (`noindex`, `robots.txt` qui interdit tout) : Merlin est un outil interne.
- Couleur de marque centralisée dans `src/app/globals.css` (`--brand-600`, commentaire en tête de fichier).

## Étapes terminées

- ✅ **Étape 1** — Initialisation du projet : Next.js 15 + outillage (ESLint, Prettier, Vitest, Playwright), structure de dossiers, design system (tokens Tailwind v4, composants shadcn/ui adaptés), layout responsive (header, footer, conteneur), page d'accueil provisoire, route `/api/health`, `robots.ts`, documentation de base.

_Mettre à jour cette liste à la fin de chaque étape._
