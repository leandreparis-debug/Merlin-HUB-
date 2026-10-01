# Architecture

## Principes clés

### Couche d'abstraction données et authentification

Merlin migrera à terme vers une infrastructure différente de celle de son lancement (voir [Trajectoire V1 → V2](#trajectoire-v1--v2)). Pour que cette migration ne nécessite pas de réécrire l'application, deux règles strictes s'appliquent dès l'étape 1 :

- **Aucun accès direct à une base de données en dehors de `src/lib/data`.** Toute lecture ou écriture passe par un repository exposé depuis ce dossier (voir `src/lib/data/README.md`).
- **Aucun accès direct à un fournisseur d'authentification en dehors de `src/lib/auth`.** Toute vérification de session, de rôle ou d'identité passe par le service exposé depuis ce dossier (voir `src/lib/auth/README.md`).

Les composants, pages et routes API ne connaissent que les fonctions typées exposées par ces deux dossiers, jamais les détails d'implémentation (client Supabase, requêtes SQL, SDK d'authentification).

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
- Le site n'est pas indexable (`robots.txt` et balise meta `robots` en `noindex`) : Merlin est un outil interne, pas un site public.
- La route `/api/health` ne renvoie aucune information sensible.
