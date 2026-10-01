import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseActivityLogRepository } from "@/lib/data/providers/supabase/activity-log-repository";
import { createSupabaseAnnouncementRepository } from "@/lib/data/providers/supabase/announcement-repository";
import { createSupabaseAppRepository } from "@/lib/data/providers/supabase/app-repository";
import { createSupabaseProfileRepository } from "@/lib/data/providers/supabase/profile-repository";
import { createSupabaseReportRepository } from "@/lib/data/providers/supabase/report-repository";
import type { Repositories } from "@/lib/data/repositories";

/**
 * Construit l'ensemble des repositories Supabase à partir d'un client déjà
 * configuré (`createAdminClient()` ou `createUserClient()`).
 */
export function createSupabaseRepositories(
  client: SupabaseClient,
): Repositories {
  return {
    profiles: createSupabaseProfileRepository(client),
    apps: createSupabaseAppRepository(client),
    announcements: createSupabaseAnnouncementRepository(client),
    reports: createSupabaseReportRepository(client),
    activityLog: createSupabaseActivityLogRepository(client),
  };
}
