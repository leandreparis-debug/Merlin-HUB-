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
  NEXT_PUBLIC_ADMIN_CONTACT_EMAIL: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .email({
        message:
          "NEXT_PUBLIC_ADMIN_CONTACT_EMAIL doit être une adresse email valide",
      })
      .optional(),
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
  ALLOWED_EMAIL_DOMAINS: z.preprocess(emptyToUndefined, z.string().optional()),
  MEMORY_AUTH_SECRET: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .min(16, {
        message: "MEMORY_AUTH_SECRET doit contenir au moins 16 caractères",
      })
      .optional(),
  ),
});

/**
 * Secret de signature des sessions de l'authentification en mémoire, utilisé
 * uniquement si `MEMORY_AUTH_SECRET` est absent. Valeur factice de
 * développement : interdite en production (l'auth mémoire l'est aussi).
 */
export const DEV_MEMORY_AUTH_SECRET = "merlin-dev-only-memory-auth-secret";

const serverEnvSchema = publicEnvSchema.merge(serverOnlyEnvSchema);

/**
 * Fournisseur de données : `supabase` (par défaut, utilisé en V1) ou `memory`
 * (store en mémoire, pratique pour développer sans Supabase ; jamais en production).
 */
const dataProviderSchema = z
  .preprocess(
    emptyToUndefined,
    z.enum(["supabase", "memory"], {
      message: "DATA_PROVIDER doit valoir « supabase » ou « memory »",
    }),
  )
  .default("supabase");

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type DataProvider = z.infer<typeof dataProviderSchema>;
export type ServerEnvWithDataProvider = ServerEnv & {
  DATA_PROVIDER: DataProvider;
};

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
    NEXT_PUBLIC_ADMIN_CONTACT_EMAIL:
      process.env["NEXT_PUBLIC_ADMIN_CONTACT_EMAIL"],
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
    NEXT_PUBLIC_ADMIN_CONTACT_EMAIL:
      process.env["NEXT_PUBLIC_ADMIN_CONTACT_EMAIL"],
    SUPABASE_SERVICE_ROLE_KEY: process.env["SUPABASE_SERVICE_ROLE_KEY"],
    MEMORY_AUTH_SECRET: process.env["MEMORY_AUTH_SECRET"],
    ALLOWED_EMAIL_DOMAINS: process.env["ALLOWED_EMAIL_DOMAINS"],
  });

  if (!result.success) {
    throw new Error(
      formatZodError("Variables d'environnement invalides :", result.error),
    );
  }

  return result.data;
}

/**
 * Lit et valide les variables d'environnement serveur, y compris `DATA_PROVIDER`.
 * Quand `DATA_PROVIDER=supabase` (valeur par défaut), exige que les trois
 * variables Supabase soient renseignées et liste précisément celles qui
 * manquent, sans jamais afficher leur valeur. `getEnv()` reste inchangée et
 * ne doit pas être utilisée pour ce contrôle : elle doit rester utilisable
 * sans aucune variable Supabase (pages et tests de l'étape 1). En mode
 * `memory` hors production, `MEMORY_AUTH_SECRET` retombe sur un secret de
 * développement fixe s'il n'est pas défini.
 */
export function getServerEnv(): ServerEnvWithDataProvider {
  const base = getEnv();

  const providerResult = dataProviderSchema.safeParse(
    process.env["DATA_PROVIDER"],
  );
  if (!providerResult.success) {
    throw new Error(
      formatZodError("Variable DATA_PROVIDER invalide :", providerResult.error),
    );
  }
  const dataProvider = providerResult.data;

  if (dataProvider === "supabase") {
    const missing: string[] = [];
    if (!base.NEXT_PUBLIC_SUPABASE_URL)
      missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!base.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    if (!base.SUPABASE_SERVICE_ROLE_KEY) {
      missing.push("SUPABASE_SERVICE_ROLE_KEY");
    }
    if (missing.length > 0) {
      throw new Error(
        `Variables d'environnement Supabase manquantes : ${missing.join(", ")}. ` +
          "Renseignez-les dans .env.local, ou définissez DATA_PROVIDER=memory " +
          "pour développer localement sans Supabase.",
      );
    }
  }

  if (
    dataProvider === "memory" &&
    !base.MEMORY_AUTH_SECRET &&
    process.env.NODE_ENV !== "production"
  ) {
    return {
      ...base,
      DATA_PROVIDER: dataProvider,
      MEMORY_AUTH_SECRET: DEV_MEMORY_AUTH_SECRET,
    };
  }

  return { ...base, DATA_PROVIDER: dataProvider };
}

const DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Interprète `ALLOWED_EMAIL_DOMAINS` (liste séparée par des virgules, ex.
 * `carrefour.com,carrefourproperty.fr`). Valeur absente ou vide = `[]` (aucune
 * restriction). Lève une erreur claire en français si un domaine est invalide.
 */
export function parseAllowedEmailDomains(raw: string | undefined): string[] {
  if (!raw || raw.trim() === "") return [];
  const domains = raw
    .split(",")
    .map((part) => part.trim().toLowerCase().replace(/^@/, ""))
    .filter((part) => part !== "");
  const invalid = domains.filter((domain) => !DOMAIN_PATTERN.test(domain));
  if (invalid.length > 0 || domains.length === 0) {
    throw new Error(
      "ALLOWED_EMAIL_DOMAINS est invalide : indiquez des domaines séparés par " +
        "des virgules (ex. carrefour.com,carrefourproperty.fr).",
    );
  }
  return [...new Set(domains)];
}

/** Vrai si l'email appartient à l'un des domaines autorisés (toujours vrai si la liste est vide). */
export function isEmailDomainAllowed(
  email: string,
  allowedDomains: readonly string[],
): boolean {
  if (allowedDomains.length === 0) return true;
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  return allowedDomains.includes(domain);
}
