import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { notImplementedMethod } from "@/lib/data/providers/not-implemented";
import type { AnnouncementRepository } from "@/lib/data/repositories/announcement-repository";

const STEP_MESSAGE =
  "AnnouncementRepository (Supabase) : implémentation prévue à l'étape 7.";

/** Stub Supabase de {@link AnnouncementRepository} — implémentation prévue à l'étape 7. */
export function createSupabaseAnnouncementRepository(
  _client: SupabaseClient,
): AnnouncementRepository {
  return {
    list: notImplementedMethod(STEP_MESSAGE),
    getById: notImplementedMethod(STEP_MESSAGE),
    create: notImplementedMethod(STEP_MESSAGE),
    update: notImplementedMethod(STEP_MESSAGE),
    delete: notImplementedMethod(STEP_MESSAGE),
  };
}
