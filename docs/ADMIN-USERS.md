# Administration des utilisateurs (étape 6)

La section « Utilisateurs » de l'administration (`/admin/users`) permet à un admin (en vue admin) de gérer tous les comptes : création avec mot de passe provisoire, réinitialisation manuelle, changement de rôle, désactivation / réactivation, modification du nom.

## Écrans

| Route               | Contenu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/users`      | Liste de tous les comptes (actifs et désactivés), triés par nom puis email. Colonnes : nom, email, rôle, état, « Première connexion en attente », dernière connexion (« Jamais connecté » sinon), « Gérer ». Votre ligne est marquée « Vous ». Recherche (nom ou email, insensible à la casse et aux accents) et filtres rapides combinables (Tous, Actifs, Désactivés, Admins, Première connexion en attente), reflétés dans l'URL (`?q=`, `?filter=`, paramètres validés). Compteur `aria-live`. |
| `/admin/users/new`  | Création : email pro, nom complet (facultatif), rôle (avertissement visible pour « Admin »). Le succès **reste sur la page** et affiche le panneau de mot de passe provisoire.                                                                                                                                                                                                                                                                                                                     |
| `/admin/users/[id]` | Fiche : Informations (email en lecture seule, nom modifiable, dates), Rôle, Accès (désactiver / réactiver avec confirmation), Mot de passe (réinitialisation avec confirmation), Activité récente (20 dernières actions du compte). Un id inconnu ou mal formé affiche « Utilisateur introuvable ».                                                                                                                                                                                                |

Le tableau de bord (`/admin`) affiche en plus des tuiles « Utilisateurs » : comptes, comptes actifs, admins actifs, première connexion en attente.

## Règles et garde-fous (imposés côté serveur)

Les fonctions de `src/lib/admin/users/user-rules.ts` (`canChangeRole`, `canDeactivate`, `canReactivate`, `canResetPassword`) sont utilisées **à la fois** par les actions (qui relisent la cible et `countActiveAdmins()` à chaque appel) et par l'interface (contrôles désactivés avec explication). L'interface n'est qu'un confort : un formulaire forgé est refusé par le serveur.

- **Pas d'auto-sabotage** : un admin ne peut ni se désactiver, ni se rétrograder, ni réinitialiser son propre mot de passe depuis cette interface (il utilise « Changer mon mot de passe »).
- **Toujours au moins un admin actif** : on ne peut ni désactiver ni rétrograder le dernier admin actif. Comme l'acteur est lui-même un admin actif, ce garde-fou ne peut jouer que dans une course entre deux admins (voir limites).
- **L'email n'est pas modifiable** : c'est l'identifiant (et la future clé SSO). Pour changer d'adresse, créer un nouveau compte.
- **Pas de suppression de compte en V1** : la désactivation conserve l'historique et le journal d'activité.
- **Domaines autorisés (facultatif)** : `ALLOWED_EMAIL_DOMAINS` (liste séparée par des virgules, ex. `carrefour.com,carrefourproperty.fr`). Si elle est définie, la création refuse les emails hors de ces domaines ; absente ou vide, aucune restriction (cas du développement avec `example.test`) ; un format invalide donne une erreur claire au premier usage.

## Cycle de vie d'un compte

1. **Création** : l'admin saisit email, nom, rôle. `AccountAdminService.createAccount` crée le compte Auth (email confirmé) et son profil (rôle demandé, `mustChangePassword = true`) et renvoie un mot de passe provisoire.
2. **Communication** : l'admin transmet l'adresse, l'email et le mot de passe provisoire **hors de Merlin** (le panneau propose « Copier les informations de connexion »).
3. **Première connexion** : l'utilisateur se connecte avec le mot de passe provisoire, est forcé vers `/change-password`, y saisit le provisoire comme mot de passe actuel puis en choisit un nouveau (politique : 12 à 128 caractères, différent, sans la partie locale de l'email).
4. **Réinitialisation** : l'admin génère un nouveau mot de passe provisoire (l'ancien cesse de fonctionner, `mustChangePassword` repasse à vrai). Une session déjà ouverte est renvoyée vers `/change-password` à la requête suivante.
5. **Désactivation** : effective **immédiatement** (le profil est relu à chaque requête : un compte désactivé est déconnecté à sa prochaine requête), historique conservé. La connexion avec le bon mot de passe affiche « Ce compte est désactivé. Contactez l'administrateur. » **Réactivation** : à tout moment.

## Mot de passe provisoire

- Généré **côté serveur**, dans le service (`src/lib/auth/provisional-password.ts`) : aléa cryptographique (`crypto.randomInt`), 20 caractères, alphabet sans caractères ambigus (`0 O 1 l I`), au moins une majuscule, une minuscule, un chiffre et un symbole simple, régénéré s'il contient la partie locale de l'email ou viole la politique de mot de passe. Un admin ne peut pas le choisir.
- **Jamais** stocké (ni en base, ni en cookie, ni en session, ni en cookie « flash »), journalisé (console ou journal d'activité), placé dans une URL, ni renvoyé par une page chargée en GET.
- Il n'existe que dans le **résultat de la server action** (état de `useActionState`), affiché **une seule fois** dans le panneau dédié ; un rechargement le fait disparaître, de même que « J'ai noté le mot de passe » (le composant qui détenait l'état est démonté).
- Les pages de l'application sont en `Cache-Control: no-store`.

## Abstraction `AccountAdminService`

`src/lib/auth/account-admin.ts` (interface), implémentations `providers/supabase/account-admin.ts` et `providers/memory/account-admin.ts`, fabrique `getAccountAdminService()` (selon `DATA_PROVIDER`). **C'est la seule voie de gestion des comptes Auth** ; elle n'est appelée qu'après `requireAdmin()`.

- `createAccount` (Supabase) : `auth.admin.createUser({ email, password, email_confirm: true, user_metadata })` avec le client service role, puis mise à jour du profil créé par le trigger (rôle, `mustChangePassword`). Erreurs `email_exists` / `user_already_exists` → `email_exists` ; le reste → `unexpected` sans détail.
- **Compensation** : si la mise à jour du profil échoue après la création du compte Auth, le compte Auth est supprimé. Si cela échoue aussi, un message générique est journalisé (sans email ni mot de passe) et l'interface affiche « Le compte a peut-être été créé : vérifiez la liste des utilisateurs. » Le rôle n'est appliqué qu'en dernier : un échec partiel ne laisse jamais un compte avec un rôle supérieur à `user`.
- `resetPassword` : pose `mustChangePassword = true` puis `auth.admin.updateUserById(id, { password })`.
- `revokeSessions` : meilleur effort, ne lève jamais. L'API `auth.admin.signOut(jwt, scope)` attend le **JWT** de la session à révoquer, pas un identifiant d'utilisateur : elle n'est pas détournée. Les sessions mémoire sont des cookies signés sans état serveur. Le blocage repose donc sur la relecture du profil à chaque requête (voir `docs/AUTH.md`).

## Journal d'activité

Via `ActivityLogRepository.record` (jamais bloquant), avec `actorId`/`actorEmail` de l'admin, `entity_type = "user"` et `entity_id` = id de l'utilisateur ciblé. **Aucun mot de passe, jeton ni secret** dans les métadonnées.

| Action                                  | Métadonnées                         |
| --------------------------------------- | ----------------------------------- |
| `user.created`                          | email cible normalisé, rôle         |
| `user.updated`                          | `fields` : noms des champs modifiés |
| `user.role_changed`                     | `from`, `to`                        |
| `user.deactivated` / `user.reactivated` | —                                   |
| `user.password_reset`                   | —                                   |

## Autorisation

`requireAdmin()` est appelé dans le layout d'administration, dans **chaque page** et en **première instruction de chaque server action** (`src/app/(app)/admin/users/actions.ts`). L'acteur vient de la session serveur, jamais d'un champ de formulaire. Un admin en vue utilisateur est refusé comme un utilisateur simple. Les tests `actions.test.ts` (chaque action refuse un non-connecté, un utilisateur simple — avec ou sans cookie `merlin_view` forgé — et un admin en vue utilisateur, sans mutation) et `admin-guards.test.ts` (analyse statique des layouts, pages et actions, y compris `getAccountAdminService`) verrouillent la règle.

## Limites connues

- **Course entre deux admins** : la règle « dernier admin actif » repose sur `countActiveAdmins()` lu juste avant l'écriture ; deux admins qui se désactivent simultanément peuvent, en théorie, ne laisser aucun admin actif (dernière écriture gagnante, pas de verrou en V1). Le script `db:bootstrap-admin --force` permet de rétablir un admin.
- **Révocation des sessions** : voir ci-dessus ; les sessions Supabase déjà émises restent des jetons valides côté fournisseur jusqu'à expiration, mais ne donnent aucun accès à l'application (profil relu à chaque requête).
- **Pas de suppression de compte** ; pas de modification d'email.

## Stratégie e2e

- Lecture seule (`e2e/admin-users.spec.ts`, 3 viewports) : liste, « Vous », « Désactivé », « Première connexion en attente », recherche et filtres, URL, fiche, contrôles désactivés pour soi-même, contrôle d'accès (non connecté, utilisateur, admin en vue utilisateur, cookie `merlin_view` forgé). Ces tests ne dépendent jamais du nombre total de comptes.
- Mutations (`e2e/users-mutations.spec.ts`, projet `mutations`, desktop, en série, après les autres projets) : chaque test crée ses comptes avec un email unique `test-<horodatage-aléatoire>@example.test` ; faute de suppression de compte en V1, ils sont **désactivés** en fin de test (`afterEach`) et disparaissent au redémarrage du serveur mémoire. Les comptes de dev `admin`, `user` et `desactive` ne sont jamais modifiés ; `nouveau` n'est utilisé que par le test de changement forcé du mot de passe provisoire (déplacé ici depuis `auth.spec.ts`, car il modifie l'état).
- Le scénario « dernier admin actif » est couvert en tests unitaires (règles et actions avec `countActiveAdmins` simulé) : en e2e, l'acteur étant lui-même un admin actif, l'état n'est pas atteignable sans désactiver le compte `admin` de dev, ce que l'isolation des tests interdit.

## Notes de migration V2 (SSO)

Avec un SSO d'entreprise, l'identité est fournie par le SSO (l'email pro reste la clé) :

- **Disparaissent** : la création de compte avec mot de passe provisoire, la réinitialisation de mot de passe, le panneau de mot de passe provisoire, `/change-password`, `mustChangePassword`, `AccountAdminService.createAccount/resetPassword` (remplacés par l'acceptation de l'email : un utilisateur d'un domaine autorisé s'authentifie via le SSO et son profil est créé ou rattaché à la première connexion).
- **Restent** : rôles et désactivation lus dans `profiles` à chaque requête, règles métier (`user-rules`), journal d'activité, liste, fiche (rôle, accès, activité), `ALLOWED_EMAIL_DOMAINS` (domaines acceptés), garde-fou « dernier admin actif ».
- **À remplacer** : l'implémentation d'`AccountAdminService` (préprovisionnement éventuel d'un profil par email au lieu de créer un compte Auth) et `revokeSessions` (révocation côté SSO si disponible).
