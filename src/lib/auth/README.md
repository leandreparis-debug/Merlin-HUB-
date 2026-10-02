# `lib/auth` — service d'authentification abstrait

Unique point d'accès à l'authentification et aux rôles de Merlin (utilisateur / admin). Guide complet : `docs/AUTH.md`.

## Règle

**Aucun accès direct au fournisseur d'authentification en dehors de ce dossier** (et de `src/lib/supabase/`). Les composants, pages et server actions n'utilisent que `AuthService`, `getCurrentUser`, `requireUser` et `requireAdmin`, importés depuis `@/lib/auth`.

## Contenu

- `service.ts` / `types.ts` — interface `AuthService` (`signInWithPassword`, `signOut`, `getAuthenticatedUserId`, `updatePassword`), `SessionUser`.
- `factory.ts` — `getAuthService()` : choisit l'implémentation selon `DATA_PROVIDER`.
- `providers/supabase/` — Supabase Auth (identité vérifiée par `getUser()`), traduction des erreurs, rafraîchissement de session du middleware.
- `providers/memory/` — comptes en mémoire et session par cookie signé HMAC (dev/e2e, interdit en production), seed de comptes factices.
- `session.ts` — `getCurrentUser()` (profil lu en base à chaque requête, cache par requête), `requireUser()`, `requireAdmin()`.
- `view-mode.ts` — vue admin/utilisateur (cosmétique, jamais une autorisation).
- `actions.ts` — server actions : `loginAction`, `changePasswordAction`, `logoutAction`, `toggleViewModeAction`.
- `redirect.ts`, `password-policy.ts`, `schemas.ts`, `audit.ts`, `cookies.ts`, `constants.ts`.

## Règles à respecter

- Toute nouvelle page ou action protégée appelle `requireUser()` / `requireAdmin()` : le middleware n'est qu'un confort.
- Rôle, `isActive`, `mustChangePassword` : toujours lus dans `profiles`, jamais dans le JWT.
- Ne jamais décider d'un accès avec `getSession()`.

## V1 → V2

- **V1 (Vercel + Supabase)** : email professionnel + mot de passe via Supabase Auth, rôles en base.
- **V2 (serveur interne Carrefour Property)** : SSO d'entreprise. Seules l'implémentation d'`AuthService` et le middleware changent (voir « Notes de migration V2 » dans `docs/AUTH.md`).
