import { notImplementedMethod } from "@/lib/data/providers/not-implemented";
import type { AnnouncementRepository } from "@/lib/data/repositories/announcement-repository";

const STEP_MESSAGE =
  "AnnouncementRepository (mémoire) : implémentation prévue à l'étape 7.";

/** Stub mémoire de {@link AnnouncementRepository} — implémentation prévue à l'étape 7. */
export function createMemoryAnnouncementRepository(): AnnouncementRepository {
  return {
    list: notImplementedMethod(STEP_MESSAGE),
    getById: notImplementedMethod(STEP_MESSAGE),
    create: notImplementedMethod(STEP_MESSAGE),
    update: notImplementedMethod(STEP_MESSAGE),
    delete: notImplementedMethod(STEP_MESSAGE),
  };
}
