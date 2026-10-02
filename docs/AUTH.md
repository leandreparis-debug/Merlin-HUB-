# Authentification, rôles et vue admin/utilisateur (étape 3)

## Vue d'ensemble

- Identifiant = **email professionnel** + mot de passe. **Pas d'inscription libre** : les comptes sont créés par un administrateur avec un mot de passe provisoire (étape 6 ; le premier admin via `npm run db:bootstrap-admin`).
- **Pas de « mot de passe oublié » par email** : l'administrateur réinitialise à la main. La page de connexion invite à le contacter (`NEXT_PUBLIC_ADMIN_CONTACT_EMAIL`, facultatif, ajoute un lien `mailto:`).
- Deux rôles, `user` et `admin`, stockés dans `profiles.role`.
- Tout passe par `src/lib/auth` : `AuthService` (interface remplaçable), `getCurrentUser`, `requireUser`, `requireAdmin`. Aucun composant ni action n'importe `@supabase/*`.

## Flux de connexion

1. `/login` (public) : formulaire email + mot de passe → server action `loginAction`.
2. Validation zod (email normalisé en minuscules), puis `AuthService.signInWithPassword`.
3. Succès : `lastLoginAt` mis à jour, journal `auth.login`, redirection vers `next` (validé par `safeRedirectPath`) — ou vers `/change-password` si `mustChangePassword`.
4. Échec : message **générique** « Email ou mot de passe incorrect » (email inconnu et mauvais mot de passe sont indiscernables, y compris en temps de réponse : délai minimal de 300 ms sur échec). Seule exception : un compte désactivé est annoncé (« Ce compte est désactivé. Contactez l'administrateur. ») **après** un mot de passe correct. Journal `auth.login_failed` (email saisi normalisé et raison, jamais le mot de passe).
5. Un utilisateur déjà connecté qui visite `/login` est renvoyé vers `next` ou `/` (contrôle fait dans la page, côté serveur, avec le profil lu en base).

### Premier login et changement forcé

Un compte créé par un admin a `must_change_password = true`. Tant que c'est le cas, `requireUser()` redirige toute page vers `/change-password` (seule page qui passe `allowPasswordChange: true`) et le menu utilisateur est réduit à « Se déconnecter ». `changePasswordAction` : vérifie la politique, la confirmation et le mot de passe actuel, change le mot de passe, remet `mustChangePassword` à `false` (écriture service role), journalise `auth.password_changed`, puis redirige vers `/?notice=password-changed` (message affiché une fois).

**Politique de mot de passe** (`password-policy.ts`) : 12 à 128 caractères, différent de l'actuel, ne contient pas la partie locale de l'email (casse ignorée, testée à partir de 3 caractères pour éviter les faux positifs). Aucune règle de composition.

## Rôles

Le rôle, `isActive` et `mustChangePassword` sont **lus dans la table `profiles` à chaque requête protégée** (`getCurrentUser()`, mis en cache par requête avec `React.cache`). Ils ne viennent **jamais** du JWT ni des métadonnées utilisateur. Un profil inconnu ou désactivé = pas de session valide (et déconnexion).

## Vue admin / vue utilisateur : cosmétique vs autorisation réelle

Un admin peut « voir le site comme un utilisateur » (menu utilisateur ou bandeau, action `toggleViewModeAction`).

- La préférence est un cookie `merlin_view` (`httpOnly`, `sameSite=lax`, `secure` en production, `path=/`).
- **Le cookie est cosmétique** : il ne donne ni ne retire aucun droit. `getViewMode()` renvoie toujours `"user"` pour un non-admin, quelle que soit la valeur du cookie ; un utilisateur qui forge `merlin_view=admin` n'obtient donc rien.
- `requireAdmin()` exige le rôle `admin` (lu en base) **et** la vue admin ; sinon redirection vers `/`. Le rôle est l'autorisation réelle, la vue est un confort d'affichage.
- Toute action serveur sensible réservée aux admins doit appeler `requireAdmin()` (ou vérifier `role === "admin"`), jamais se fier à l'interface.
- Journal `auth.view_mode_changed` (vue choisie).

## Modèle de sécurité

- **`getUser()` et non `getSession()`** : l'identité côté serveur est vérifiée par le serveur Auth (`supabase.auth.getUser()`), qui valide le jeton. `getSession()` lit seulement le cookie, sans validation : jamais utilisé pour une décision d'accès.
- **Le middleware n'est qu'un confort d'affichage** (`src/middleware.ts`) : il rafraîchit la session Supabase (pattern `@supabase/ssr`), transmet le chemin courant aux pages (en-tête `x-merlin-path`, réécrit à chaque requête) et redirige les non-connectés vers `/login?next=…` pour les routes protégées connues (`isProtectedPath` dans `src/lib/auth/constants.ts` : `/`, `/admin`, `/change-password` ; à compléter pour toute nouvelle route de premier niveau). Les URL inconnues passent pour que la 404 reste publique. **Toute autorisation réelle est refaite côté serveur** : `requireUser()` dans le layout `(app)`, puis `requireUser()`/`requireAdmin()` dans chaque page et server action.
- **Règle pour tout nouveau code** : toute nouvelle page ou action protégée appelle `requireUser()` ou `requireAdmin()`.
- **Redirections sûres** : `safeRedirectPath` n'accepte qu'un chemin relatif commençant par un seul `/` (pas de `//`, de schéma, de `\`, de caractère de contrôle, ≤ 200 caractères, jamais `/login`) ; sinon `/`.
- **Pas de fuite** : messages de connexion génériques, aucune réponse ne révèle l'existence d'un email ; aucun mot de passe, jeton ni email complet dans les logs console (erreurs inattendues journalisées avec un message générique).
- **Cache** : `Cache-Control: no-store` sur toutes les routes applicatives (`next.config.ts`) ; les pages protégées sont dynamiques. Après déconnexion, le bouton Retour ne réaffiche pas une page protégée.
- **Mutations par server actions** (connexion, déconnexion, changement de mot de passe, bascule de vue) : pas de route API d'authentification custom.
- **Journal d'activité** (`ActivityLogRepository.record`, qui ne fait jamais échouer l'action) : `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_changed`, `auth.view_mode_changed`.

## Blocage des sessions existantes (désactivation, réinitialisation)

`getCurrentUser()` relit `profiles` **à chaque requête** : un compte désactivé est déconnecté dès sa prochaine requête (même avec une session encore valide), et un compte dont le mot de passe a été réinitialisé (`mustChangePassword = true`) est redirigé vers `/change-password`, où le **mot de passe actuel** (le nouveau provisoire) est exigé. En plus, `AccountAdminService.revokeSessions(userId)` est appelé en meilleur effort à la désactivation ; en V1 il ne révoque rien : l'API `auth.admin.signOut(jwt, scope)` de Supabase attend le JWT de la session à révoquer, pas un identifiant d'utilisateur, et n'est pas détournée. Voir `docs/ADMIN-USERS.md`.

## Implémentations

| `DATA_PROVIDER`      | Implémentation                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase` (défaut)  | `src/lib/auth/providers/supabase` — Supabase Auth (`signInWithPassword`, `getUser`, `updateUser`). Erreurs traduites (`invalid_credentials` → identifiants invalides ; `over_request_rate_limit`/429 → « Trop de tentatives… » ; le reste → `unexpected` sans détail). Le changement de mot de passe revérifie d'abord le mot de passe actuel. |
| `memory` (dev / e2e) | `src/lib/auth/providers/memory` — comptes en mémoire (hash scrypt + sel, `timingSafeEqual`), session = cookie `merlin_dev_session` signé HMAC-SHA256 (secret `MEMORY_AUTH_SECRET`). Partage les profils du store mémoire des repositories. **Interdit en production** (erreur explicite si `NODE_ENV=production`).                             |

### Comptes de développement (implémentation mémoire)

Valeurs **factices**, uniquement créées si `NODE_ENV !== "production"`, **inutilisables hors dev** :

| Email                    | Mot de passe         | Particularité                             |
| ------------------------ | -------------------- | ----------------------------------------- |
| `admin@example.test`     | `Admin-Password-123` | administrateur                            |
| `user@example.test`      | `User-Password-123`  | utilisateur                               |
| `nouveau@example.test`   | `Temp-Password-1234` | doit changer son mot de passe (1er login) |
| `desactive@example.test` | `Disabled-Pass-123`  | compte désactivé                          |

Lancer : `DATA_PROVIDER=memory npm run dev`. Le store étant en mémoire du process, tout est réinitialisé au redémarrage (dont les mots de passe changés).

## Tests

- Unitaires : `redirect`, `password-policy`, `view-mode`, provider mémoire, provider Supabase (client simulé), traduction d'erreurs, `requireUser`/`requireAdmin`, server actions, `UserMenu`, `LoginForm`.
- E2E (`e2e/auth.spec.ts`, serveur `next dev` sur le port 3100 avec `DATA_PROVIDER=memory`, sans variable Supabase) : redirections, connexion et erreurs, `next` malveillant, changement forcé, déconnexion, rôles, bascule de vue, cookie `merlin_view` forgé.
- `next dev` et non `next start` pour les e2e : l'auth mémoire est volontairement interdite en production.

## Notes de migration V2 (SSO)

**À remplacer** :

- L'implémentation d'`AuthService` (`src/lib/auth/providers/…`) et son câblage dans `src/lib/auth/factory.ts` : un fournisseur SSO d'entreprise (réseau fermé) à la place de Supabase Auth. `signInWithPassword` et `updatePassword` pourront disparaître ou devenir sans effet (le SSO gère l'identité) ; `getAuthenticatedUserId()` doit renvoyer l'identifiant vérifié par le SSO.
- Le middleware (`src/middleware.ts` et `providers/supabase/middleware.ts`) : validation de la session du SSO à la place du rafraîchissement Supabase. Il reste un confort UX.
- La page `/login` et les formulaires de mot de passe, si le SSO redirige vers son propre écran.

**Ne change pas** :

- Les helpers (`getCurrentUser`, `requireUser`, `requireAdmin`, `getViewMode`), le layout `(app)`, le menu utilisateur et la bascule de vue.
- Les rôles lus en base (`profiles`), la journalisation, la validation des redirections.
- La règle : l'autorisation réelle est refaite côté serveur à chaque requête.
