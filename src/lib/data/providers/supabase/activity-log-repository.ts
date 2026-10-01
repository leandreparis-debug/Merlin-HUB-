import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { translateSupabaseError } from "@/lib/data/providers/supabase/errors";
import {
  activityLogEntryFromRow,
  recordActivityLogInputToRow,
  type ActivityLogRow,
} from "@/lib/data/providers/supabase/rows";
import type { ActivityLogRepository } from "@/lib/data/repositories/activity-log-repository";

/**
 * Implémentation Supabase de {@link ActivityLogRepository}. `record` capture
 * systématiquement ses erreurs : l'écriture du journal ne doit jamais faire
 * échouer l'action applicative qui l'a déclenchée.
 */
export function createSupabaseActivityLogRepository(
  client: SupabaseClient,
): ActivityLogRepository {
  return {
    async record(entry) {
      try {
        const row = recordActivityLogInputToRow(entry);
        const { error } = await client.from("activity_log").insert(row);
        if (error) {
          console.error(
            "Échec de l'écriture dans le journal d'activité.",
            error,
          );
        }
      } catch (cause) {
        console.error("Échec de l'écriture dans le journal d'activité.", cause);
      }
    },

    async list(options) {
      let query = client
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false });

      if (options?.actorId) query = query.eq("actor_id", options.actorId);
      if (options?.action) query = query.eq("action", options.action);
      if (options?.cursor) query = query.lt("created_at", options.cursor);

      query = query.limit(options?.limit ?? 50);

      const { data, error } = await query.returns<ActivityLogRow[]>();
      if (error) throw translateSupabaseError(error, "Journal d'activité");
      return (data ?? []).map(activityLogEntryFromRow);
    },
  };
}
