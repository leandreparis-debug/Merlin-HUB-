# `lib/data` — couche d'accès aux données

Unique point d'accès aux données de Merlin (profils, catalogue d'apps,
annonces, signalements, journal d'activité).

## Règle

**Aucun accès direct à la base de données en dehors de ce dossier** (et de
`src/lib/supabase`, `scripts/`, et des tests). Les composants, les routes
API et les server actions ne doivent jamais importer `@supabase/*`
directement : ils passent toujours par un repository exposé depuis ce
dossier. Cette règle est imposée par ESLint (`no-restricted-imports` dans
`eslint.config.mjs`).

## Organisation

- **`types.ts`** — types de domaine purs (camelCase, dates ISO 8601), sans dépendance Supabase.
- **`schemas.ts`** — schémas zod pour toute entrée d'écriture (reprend les contraintes SQL : longueurs, formats, messages en français).
- **`errors.ts`** — erreurs communes (`NotFoundError`, `ConflictError`, `ValidationError`, `UnexpectedRepositoryError`, `NotImplementedError`), sans fuite de détail interne.
- **`repositories/`** — interfaces (`ProfileRepository`, `AppRepository`, `AnnouncementRepository`, `ReportRepository`, `ActivityLogRepository`), regroupées dans le type `Repositories`.
- **`providers/supabase/`** — implémentation Supabase (V1), avec ses propres mappers (`rows.ts`) et sa traduction d'erreurs Postgres (`errors.ts`).
- **`providers/memory/`** — implémentation en mémoire, isolée par instance, pour développer sans Supabase (`DATA_PROVIDER=memory`). Reproduit fidèlement les règles SQL (unicité, validation, historique de statut). **Jamais utilisée en production** (garde-fou dans `index.ts`).
- **`contract/`** — suites de tests réutilisables (`run*RepositoryContract`), exécutées contre n'importe quelle implémentation satisfaisant l'interface.
- **`index.ts`** — fabrique : `getUserRepositories()` (RLS appliquée) et `getAdminRepositories()` (service role, réservé aux opérations serveur après vérification du rôle admin).

## Pourquoi

Carrefour Property prévoit de migrer Merlin vers un serveur interne (réseau
fermé, Docker, SQL Server probable), avec SSO. Cette indirection permet
d'ajouter une implémentation `providers/sqlserver/` pour la V2 sans modifier
le reste de l'application — seul `index.ts` changera d'implémentation
sélectionnée. Détails du schéma SQL et notes de migration V2 :
`docs/DATA-MODEL.md`.
