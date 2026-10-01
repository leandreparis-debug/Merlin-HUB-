# `lib/data` — couche d'accès aux données

Ce dossier contiendra, à partir de l'étape 2, l'unique point d'accès aux données de Merlin (catalogue d'apps, utilisateurs, annonces, signalements, journal d'activité).

## Règle

**Aucun accès direct à la base de données en dehors de ce dossier.** Les composants, les routes API et les server actions ne doivent jamais appeler un client de base de données (Supabase, driver SQL Server, etc.) directement : ils passent toujours par un repository exposé depuis `lib/data`.

## Contrat prévu

- Un repository par domaine (ex. `apps.repository.ts`, `users.repository.ts`, `announcements.repository.ts`, `reports.repository.ts`, `activity-log.repository.ts`).
- Chaque repository expose des fonctions typées (ex. `getApps()`, `getAppBySlug(slug)`, `updateAppStatus(id, status)`) qui retournent des types définis dans `src/types`.
- L'implémentation concrète (requêtes Postgres via Supabase en V1, requêtes SQL Server en V2) reste un détail interne au dossier : le reste de l'application ne connaît que la signature des fonctions.
- Cette indirection permet de changer de fournisseur de données (V1 Vercel + Supabase → V2 serveur interne Carrefour Property + SQL Server) sans modifier le code appelant.

## Pourquoi

Carrefour Property prévoit de migrer Merlin vers un serveur interne (réseau fermé, Docker, SQL Server probable). Isoler l'accès aux données dès le départ évite une réécriture profonde de l'application lors de cette migration.
