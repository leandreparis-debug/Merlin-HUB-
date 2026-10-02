# Configuration Supabase (V1)

Guide pas à pas pour connecter Merlin à un projet Supabase. À suivre une
fois par environnement (développement, puis plus tard production).

## 1. Créer le projet Supabase

Sur [supabase.com](https://supabase.com), créer un nouveau projet (choisir
une région proche des utilisateurs, ex. Europe). Noter le mot de passe de
base de données généré : il n'est utile que pour un accès direct `psql`, pas
pour Merlin.

## 2. Désactiver les inscriptions libres

Merlin n'a pas de page d'inscription : les comptes sont créés par un
administrateur (`npm run db:bootstrap-admin`, puis l'administration des
utilisateurs à l'étape 6). Pour éviter que n'importe qui puisse créer un
compte directement via l'API Supabase Auth :

1. Dans le dashboard Supabase : **Authentication → Providers → Email**.
2. Désactiver **« Allow new users to sign up »** (ou équivalent selon la
   version du dashboard : **Authentication → Settings → User Signups**).

### Autres réglages Authentication à vérifier (étape 3)

Dans **Authentication** du dashboard :

- **Inscriptions désactivées** (voir ci-dessus) : aucun compte ne se crée hors de l'administration.
- **Durée de vie des sessions / du JWT** raisonnable : JWT expiry par défaut (1 h) conservé ; si votre offre le permet, définir une durée maximale de session (ex. 8 h) et un délai d'inactivité (**Authentication → Sessions**).
- **Limitations de débit activées** (**Authentication → Rate Limits**) : conserver les limites par défaut sur les connexions par mot de passe ; Merlin affiche « Trop de tentatives, réessayez dans quelques minutes » quand Supabase répond par une limitation.
- **Aucun flux de récupération de mot de passe par email** : Merlin n'utilise ni « Reset password » ni lien magique. Ne pas configurer ces modèles d'email ; l'administrateur réinitialise le mot de passe à la main (étape 6).
- **Confirmation d'email** : les comptes sont créés par le service role avec l'email déjà confirmé.

**Le mot de passe provisoire est communiqué hors application** (en main propre, téléphone, canal sécurisé) : Merlin n'envoie jamais de mot de passe par email. Il doit être changé à la première connexion.

### Gestion des comptes par l'application (étape 6)

La création et la réinitialisation de mot de passe d'un compte passent par l'**API d'administration de Supabase Auth** (`auth.admin.createUser`, `auth.admin.updateUserById`), qui utilise la clé `service_role` : elle reste côté serveur, jamais exposée au navigateur, jamais journalisée. Les comptes sont créés avec leur email confirmé et un mot de passe provisoire généré par Merlin (communiqué hors application). `ALLOWED_EMAIL_DOMAINS` (facultatif, ex. `carrefour.com`) limite les domaines acceptés à la création.

## 3. Récupérer les clés

Dans **Project Settings → API** :

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`

**La clé `service_role` contourne la RLS : ne jamais la préfixer
`NEXT_PUBLIC_`, ne jamais la commiter, ne jamais la transmettre côté
navigateur.** Elle n'est lue que par du code serveur marqué
`import "server-only"` (`src/lib/supabase/admin.ts`).

## 4. Appliquer les migrations

Deux options équivalentes :

### Option A — CLI Supabase

```bash
npx supabase login
npx supabase link --project-ref <ref-du-projet>
npx supabase db push
```

(`supabase init` crée le `config.toml` manquant si besoin — il n'est pas
versionné dans ce dépôt.)

### Option B — SQL Editor (sans la CLI)

```bash
npm run db:bundle
```

Génère `supabase/all-in-one.sql` (toutes les migrations concaténées, dans
l'ordre). Ouvrir **SQL Editor** dans le dashboard Supabase, coller le
contenu du fichier, exécuter.

Dans les deux cas, les migrations sont idempotentes (`IF NOT EXISTS` sur les
objets qui le permettent) : les relancer sur un projet déjà à jour ne casse
rien.

## 5. Renseigner `.env.local`

```bash
cp .env.example .env.local
```

Puis compléter `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et
`SUPABASE_SERVICE_ROLE_KEY` avec les valeurs récupérées à l'étape 3. Laisser
`DATA_PROVIDER` commenté (la valeur par défaut `supabase` s'applique).

## 6. Créer le premier administrateur

```bash
npm run db:bootstrap-admin -- --email admin@carrefourproperty.fr --name "Prénom Nom"
```

Le mot de passe provisoire généré s'affiche **une seule fois** dans la
console : le transmettre à l'administrateur par un canal sécurisé (il devra
le changer à sa première connexion). La commande refuse de s'exécuter si un
administrateur actif existe déjà (option `--force` pour forcer).

## 7. Données de développement (facultatif)

`supabase/seed.sql` ajoute deux applications d'exemple, pratiques pour
visualiser le catalogue (étape 4) sans attendre d'avoir de vraies
applications à référencer. **Ne jamais l'appliquer sur un projet de
production.** Pour l'appliquer sur un projet de développement : copier son
contenu dans le SQL Editor, ou `npx supabase db push` l'inclut
automatiquement si la CLI Supabase est utilisée en local (`supabase start`).

## Rappel sécurité

- La clé `service_role` ne doit jamais être exposée côté client, ni commitée,
  ni journalisée (le script `bootstrap-admin` ne l'affiche jamais).
- Les inscriptions libres doivent rester désactivées (étape 2) : les comptes
  sont créés par le service role, jamais par les utilisateurs eux-mêmes.
- Pour un environnement de test des contrats de repository contre un vrai
  projet Supabase (`SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_ROLE_KEY`,
  voir `src/lib/data/providers/supabase/integration.test.ts`), utiliser un
  projet Supabase **dédié aux tests**, jamais le projet de production : cette
  suite écrit des données réelles et ne les nettoie pas.
