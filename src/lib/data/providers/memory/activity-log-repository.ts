import { validationErrorFromZod } from "@/lib/data/errors";
import type { MemoryStore } from "@/lib/data/providers/memory/store";
import type { ActivityLogRepository } from "@/lib/data/repositories/activity-log-repository";
import { recordActivityLogInputSchema } from "@/lib/data/schemas";

/**
 * Implémentation mémoire de {@link ActivityLogRepository}. `record` capture
 * systématiquement ses erreurs (validation incluse) : l'écriture du journal
 * ne doit jamais faire échouer l'action applicative qui l'a déclenchée.
 */
export function createMemoryActivityLogRepository(
  store: MemoryStore,
): ActivityLogRepository {
  return {
    async record(entry) {
      try {
        const result = recordActivityLogInputSchema.safeParse(entry);
        if (!result.success) {
          throw validationErrorFromZod(
            result.error,
            "Entrée de journal invalide",
          );
        }
        const data = result.data;

        store.activityLog.push({
          id: store.nextId(),
          actorId: data.actorId ?? null,
          actorEmail: data.actorEmail ?? null,
          action: data.action,
          entityType: data.entityType ?? null,
          entityId: data.entityId ?? null,
          metadata: data.metadata ?? {},
          createdAt: store.now(),
        });
      } catch (cause) {
        console.error("Échec de l'écriture dans le journal d'activité.", cause);
      }
    },

    async list(options) {
      const limit = options?.limit ?? 50;
      let entries = [...store.activityLog].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );

      if (options?.actorId) {
        entries = entries.filter((entry) => entry.actorId === options.actorId);
      }
      if (options?.action) {
        entries = entries.filter((entry) => entry.action === options.action);
      }
      const cursor = options?.cursor;
      if (cursor) {
        entries = entries.filter((entry) => entry.createdAt < cursor);
      }

      return entries.slice(0, limit);
    },
  };
}
