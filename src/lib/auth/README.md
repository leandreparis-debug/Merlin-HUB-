# `lib/auth` — service d'authentification abstrait

Ce dossier contiendra, à partir de l'étape 3, l'unique point d'accès à l'authentification et aux rôles de Merlin (utilisateur / admin).

## Règle

**Aucun accès direct au fournisseur d'authentification en dehors de ce dossier.** Les composants, les routes API et les server actions ne doivent jamais appeler le SDK Supabase Auth (ou tout futur fournisseur SSO) directement : ils passent toujours par un service d'authentification exposé depuis `lib/auth`.

## Contrat prévu

- Des fonctions typées telles que `getSession()`, `signIn(credentials)`, `signOut()`, `requireRole(role)`, retournant des types définis dans `src/types` (ex. `CurrentUser`, `UserRole`).
- L'implémentation concrète (Supabase Auth par identifiant professionnel + mot de passe en V1, SSO Carrefour Property en V2) reste un détail interne au dossier.
- Cette indirection permet de changer de fournisseur d'authentification sans modifier le code appelant (pages, layouts, middlewares).

## V1 → V2

- **V1 (Vercel + Supabase)** : authentification par email professionnel et mot de passe via Supabase Auth, gestion des rôles (utilisateur / admin) stockée en base.
- **V2 (serveur interne Carrefour Property)** : bascule vers un SSO d'entreprise (réseau fermé). Le reste de l'application ne devra pas être modifié grâce à cette couche d'abstraction.
