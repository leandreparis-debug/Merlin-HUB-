import { createMemoryActivityLogRepository } from "@/lib/data/providers/memory/activity-log-repository";
import { createMemoryAnnouncementRepository } from "@/lib/data/providers/memory/announcement-repository";
import { createMemoryAppRepository } from "@/lib/data/providers/memory/app-repository";
import { createMemoryProfileRepository } from "@/lib/data/providers/memory/profile-repository";
import { createMemoryReportRepository } from "@/lib/data/providers/memory/report-repository";
import {
  createMemoryStore,
  type MemoryStoreSeed,
} from "@/lib/data/providers/memory/store";
import type { MemoryProfileRepository } from "@/lib/data/providers/memory/profile-repository";
import type { Repositories } from "@/lib/data/repositories";

export type { MemoryProfileRepository } from "@/lib/data/providers/memory/profile-repository";
export type { MemoryStoreSeed } from "@/lib/data/providers/memory/store";

/** {@link Repositories} de l'implémentation mémoire : `profiles` expose en plus `createForTests()`. */
export type MemoryRepositories = Repositories & {
  profiles: MemoryProfileRepository;
};

/**
 * Construit un ensemble de repositories en mémoire, isolé par instance (pas
 * de partage entre deux appels). Reproduit fidèlement les règles SQL
 * (unicité, validation, `sortOrder` automatique, historique de statut).
 * `profiles` expose en plus `createForTests()`, réservée aux tests.
 */
export function createMemoryRepositories(
  seed?: MemoryStoreSeed,
): MemoryRepositories {
  const store = createMemoryStore(seed);

  return {
    profiles: createMemoryProfileRepository(store),
    apps: createMemoryAppRepository(store),
    announcements: createMemoryAnnouncementRepository(store),
    reports: createMemoryReportRepository(),
    activityLog: createMemoryActivityLogRepository(store),
  };
}
