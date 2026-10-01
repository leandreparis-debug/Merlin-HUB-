import { z } from "zod";

/**
 * Transforme une chaîne vide (valeur par défaut d'une variable non définie dans `.env`)
 * en `undefined`, pour que les validations optionnelles ne soient pas déclenchées par
 * une variable présente mais vide.
 */
function emptyToUndefined(value: unknown): unknown {
  return value === "" ? undefined : value;
}

/**
 * Variables d'environnement exposées au client (préfixées `NEXT_PUBLIC_`).
 * Seule `NEXT_PUBLIC_APP_URL` est obligatoire ; elle a une valeur par défaut
 * pour permettre de démarrer l'application sans configuration.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url({ message: "NEXT_PUBLIC_APP_URL doit être une URL valide" })
    .default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .url({ message: "NEXT_PUBLIC_SUPABASE_URL doit être une URL valide" })
      .optional(),
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
});

/**
 * Variables d'environnement réservées au serveur (jamais exposées au client).
 */
const serverOnlyEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(
    emptyToUndefined,
    z.string().optional(),
  ),
});

const serverEnvSchema = publicEnvSchema.merge(serverOnlyEnvSchema);

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Construit un message d'erreur clair, en français, listant chaque variable
 * d'environnement invalide et la raison du rejet.
 */
function formatZodError(prefix: string, error: z.ZodError): string {
  const details = error.issues
    .map((issue) => `  - ${issue.path.join(".")} : ${issue.message}`)
    .join("\n");
  return `${prefix}\n${details}`;
}

/**
 * Lit et valide les variables d'environnement publiques (préfixées `NEXT_PUBLIC_`).
 * Peut être appelée côté client comme côté serveur : ne contient jamais de secret.
 */
export function getPublicEnv(): PublicEnv {
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"],
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  });

  if (!result.success) {
    throw new Error(
      formatZodError(
        "Variables d'environnement publiques invalides :",
        result.error,
      ),
    );
  }

  return result.data;
}

/**
 * Lit et valide l'ensemble des variables d'environnement, y compris celles
 * réservées au serveur. Ne doit jamais être appelée depuis du code exécuté
 * côté client (composant client, code envoyé au navigateur).
 */
export function getEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env["NEXT_PUBLIC_APP_URL"],
    NEXT_PUBLIC_SUPABASE_URL: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    SUPABASE_SERVICE_ROLE_KEY: process.env["SUPABASE_SERVICE_ROLE_KEY"],
  });

  if (!result.success) {
    throw new Error(
      formatZodError("Variables d'environnement invalides :", result.error),
    );
  }

  return result.data;
}
