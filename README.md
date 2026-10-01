# Merlin

Merlin est le hub web interne de Carrefour Property : une page d'entrée, protégée par identifiant (email professionnel) et mot de passe, qui regroupe sous forme de cartes toutes les applications internes créées pour Carrefour Property.

Fonctionnalités prévues (voir [feuille de route](#feuille-de-route)) : authentification avec rôles (utilisateur / admin), catalogue d'applications avec statut manuel (en ligne / hors ligne / maintenance) et journal des changements, administration des applications et des utilisateurs, annonces épinglables, signalements de bugs ou demandes avec suivi, journal d'activité.

L'interface est en français, le code et les noms techniques sont en anglais. Usage : desktop, tablette et mobile. Mode clair uniquement.

## Prérequis

- Node.js 20 LTS (voir `.nvmrc`)
- npm

## Installation

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Variables d'environnement

Voir `.env.example`. Seule `NEXT_PUBLIC_APP_URL` est obligatoire (valeur par défaut : `http://localhost:3000`). Les variables Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) seront utilisées à partir de l'étape 2. La lecture et la validation se font via `src/lib/env.ts`.

## Scripts disponibles

| Script                 | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Démarre le serveur de développement              |
| `npm run build`        | Build de production                              |
| `npm run start`        | Démarre le serveur de production (après `build`) |
| `npm run lint`         | Vérifie le code avec ESLint                      |
| `npm run lint:fix`     | Corrige automatiquement les problèmes ESLint     |
| `npm run format`       | Formate le code avec Prettier                    |
| `npm run format:check` | Vérifie le formatage sans modifier les fichiers  |
| `npm run typecheck`    | Vérifie les types TypeScript (`tsc --noEmit`)    |
| `npm run test`         | Lance les tests unitaires (Vitest, mode run)     |
| `npm run test:watch`   | Lance les tests unitaires en mode watch          |
| `npm run test:e2e`     | Lance les tests end-to-end (Playwright)          |
| `npm run check`        | Enchaîne lint, format:check, typecheck et test   |

## Structure des dossiers

```
src/app/              Routes Next.js (App Router), layout, pages, API
src/components/ui/    Composants d'interface (shadcn/ui, adaptés aux tokens Merlin)
src/components/layout/ En-tête, pied de page, conteneur de page, lien d'évitement
src/lib/data/          Future couche d'accès aux données (repositories) — voir son README
src/lib/auth/          Futur service d'authentification abstrait — voir son README
src/lib/               Utilitaires, constantes, variables d'environnement
src/types/             Types TypeScript partagés
e2e/                   Tests end-to-end Playwright
docs/                  Documentation (architecture, etc.)
public/brand/          Logo et ressources de marque
```

Voir `docs/ARCHITECTURE.md` pour le détail des règles de dépendance entre ces dossiers.

## Convention de commits

[Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, …), en anglais, un commit par changement logique.

## Feuille de route

1. ✅ Initialisation du projet, outillage, design system, layout
2. Authentification (identifiant professionnel + mot de passe, rôles utilisateur/admin)
3. Menu utilisateur, session, protection des routes
4. Catalogue d'applications (statut en ligne/hors ligne/maintenance, journal des changements)
5. Administration des applications
6. Administration des utilisateurs
7. Annonces épinglables
8. Signalements de bugs et demandes, avec suivi
9. Journal d'activité
10. Migration V2 : serveur interne Carrefour Property, SSO, SQL Server

### Trajectoire d'hébergement

- **V1** : Vercel + Supabase (Postgres + Auth)
- **V2** : serveur interne Carrefour Property (réseau fermé, Docker, SQL Server probable), SSO

Conséquence d'architecture : tout accès aux données et à l'authentification passe par une couche d'abstraction (`src/lib/data`, `src/lib/auth`), jamais directement depuis les composants.
