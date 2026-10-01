/**
 * Exécute les suites de contrat contre un VRAI projet Supabase de test —
 * jamais contre la production. N'est activée que si `SUPABASE_TEST_URL` et
 * `SUPABASE_TEST_SERVICE_ROLE_KEY` sont définies, ce qui n'est **jamais** le
 * cas en CI par défaut (`describe.skipIf`). Utilisez exclusivement un
 * projet Supabase dédié aux tests, dont le schéma peut être librement
 * recréé : cette suite écrit des lignes réelles (apps, profils,
 * utilisateurs Auth, journal d'activité) et ne nettoie pas après elle.
 */
import { createClient } from "@supabase/supabase-js";
import { describe } from "vitest";

import { runActivityLogRepositoryContract } from "@/lib/data/contract/activity-log-repository.contract";
import { runAppRepositoryContract } from "@/lib/data/contract/app-repository.contract";
import { runProfileRepositoryContract } from "@/lib/data/contract/profile-repository.contract";
import { createSupabaseActivityLogRepository } from "@/lib/data/providers/supabase/activity-log-repository";
import { createSupabaseAppRepository } from "@/lib/data/providers/supabase/app-repository";
import { createSupabaseProfileRepository } from "@/lib/data/providers/supabase/profile-repository";

const supabaseTestUrl = process.env["SUPABASE_TEST_URL"];
const supabaseTestServiceRoleKey =
  process.env["SUPABASE_TEST_SERVICE_ROLE_KEY"];
const isEnabled = Boolean(supabaseTestUrl && supabaseTestServiceRoleKey);

/** Construit un client admin frais. Appelé uniquement depuis un test exécuté (jamais au moment de l'enregistrement de la suite). */
function getTestClient() {
  return createClient(supabaseTestUrl!, supabaseTestServiceRoleKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(!isEnabled)(
  "Intégration Supabase (projet de test réel)",
  () => {
    runAppRepositoryContract(() =>
      createSupabaseAppRepository(getTestClient()),
    );

    runProfileRepositoryContract(() => {
      const client = getTestClient();
      return {
        repo: createSupabaseProfileRepository(client),
        async createProfile(input) {
          const { data, error } = await client.auth.admin.createUser({
            email: input.email,
            password: crypto.randomUUID(),
            email_confirm: true,
            user_metadata: input.fullName
              ? { full_name: input.fullName }
              : undefined,
          });
          if (error || !data.user) {
            throw new Error(
              `Échec de création de l'utilisateur de test : ${error?.message ?? "raison inconnue"}`,
            );
          }

          const profiles = createSupabaseProfileRepository(client);
          if (input.role === "admin") {
            return profiles.update(data.user.id, { role: "admin" });
          }
          return profiles.getById(data.user.id);
        },
      };
    });

    runActivityLogRepositoryContract(() =>
      createSupabaseActivityLogRepository(getTestClient()),
    );
  },
);
