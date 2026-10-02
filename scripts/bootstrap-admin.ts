/**
 * Crée le premier compte administrateur Merlin avec le service role Supabase.
 * Génère un mot de passe provisoire aléatoire (aléa cryptographique),
 * affiché une seule fois. Refuse de s'exécuter si un admin actif existe
 * déjà, sauf avec `--force`. Exécuté via `npm run db:bootstrap-admin --
 * --email admin@carrefourproperty.fr --name "Prénom Nom"`.
 *
 * Ne journalise jamais la clé service role.
 */
import { fileURLToPath } from "node:url";

import { z } from "zod";

import { generatePassword } from "@/lib/auth/provisional-password";
import { createSupabaseProfileRepository } from "@/lib/data/providers/supabase/profile-repository";
import { createAdminClient } from "@/lib/supabase/admin";

/** Arguments en ligne de commande, déjà validés. */
export interface BootstrapAdminArgs {
  email: string;
  name?: string;
  force: boolean;
}

/** Parse et valide `--email` (requis), `--name` (facultatif) et `--force`. */
export function parseArgs(argv: string[]): BootstrapAdminArgs {
  let email: string | undefined;
  let name: string | undefined;
  let force = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--email") {
      email = argv[i + 1];
      i += 1;
    } else if (arg?.startsWith("--email=")) {
      email = arg.slice("--email=".length);
    } else if (arg === "--name") {
      name = argv[i + 1];
      i += 1;
    } else if (arg?.startsWith("--name=")) {
      name = arg.slice("--name=".length);
    } else if (arg === "--force") {
      force = true;
    }
  }

  if (!email) {
    throw new Error(
      "L'option --email est requise (ex. --email admin@carrefourproperty.fr).",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = z.string().email().safeParse(normalizedEmail);
  if (!result.success) {
    throw new Error(`Adresse email invalide : ${email}`);
  }

  const trimmedName = name?.trim();
  return {
    email: normalizedEmail,
    name: trimmedName ? trimmedName : undefined,
    force,
  };
}

// Le générateur vit dans `src/lib/auth/provisional-password.ts` (partagé avec
// l'administration des utilisateurs) ; réexporté pour les tests du script.
export { generatePassword };

/** Dépendances injectables, pour pouvoir tester `bootstrapAdmin` avec un client Supabase simulé. */
export interface BootstrapAdminDeps {
  countActiveAdmins: () => Promise<number>;
  createAuthUser: (params: {
    email: string;
    password: string;
    name?: string;
  }) => Promise<{ id: string }>;
  promoteToAdmin: (userId: string) => Promise<void>;
}

export interface BootstrapAdminResult {
  email: string;
  password: string;
  userId: string;
}

/**
 * Orchestration pure (sans accès réseau direct) : vérifie l'absence d'admin
 * actif (sauf `--force`), génère le mot de passe, crée l'utilisateur Auth
 * puis promeut son profil en administrateur.
 */
export async function bootstrapAdmin(
  args: BootstrapAdminArgs,
  deps: BootstrapAdminDeps,
): Promise<BootstrapAdminResult> {
  if (!args.force) {
    const activeAdmins = await deps.countActiveAdmins();
    if (activeAdmins > 0) {
      throw new Error(
        "Un administrateur actif existe déjà. Relancez avec --force pour en créer un supplémentaire.",
      );
    }
  }

  const password = generatePassword();
  const user = await deps.createAuthUser({
    email: args.email,
    password,
    name: args.name,
  });
  await deps.promoteToAdmin(user.id);

  return { email: args.email, password, userId: user.id };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const client = createAdminClient();
  const profiles = createSupabaseProfileRepository(client);

  const deps: BootstrapAdminDeps = {
    countActiveAdmins: () => profiles.countActiveAdmins(),
    async createAuthUser({ email, password, name }) {
      const { data, error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: name ? { full_name: name } : undefined,
      });
      if (error || !data.user) {
        throw new Error(
          `Échec de la création de l'utilisateur Auth : ${error?.message ?? "raison inconnue"}`,
        );
      }
      return { id: data.user.id };
    },
    async promoteToAdmin(userId) {
      await profiles.update(userId, {
        role: "admin",
        mustChangePassword: true,
      });
    },
  };

  const result = await bootstrapAdmin(args, deps);

  console.log("\nAdministrateur créé avec succès.");
  console.log(`  Email        : ${result.email}`);
  console.log(`  Mot de passe : ${result.password}`);
  console.log(
    "\nCe mot de passe ne sera plus jamais affiché : transmettez-le à " +
      "l'administrateur par un canal sécurisé. Il devra le changer à sa " +
      "première connexion.\n",
  );
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
