import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { notImplementedMethod } from "@/lib/data/providers/not-implemented";
import type { ReportRepository } from "@/lib/data/repositories/report-repository";

const STEP_MESSAGE =
  "ReportRepository (Supabase) : implémentation prévue à l'étape 8.";

/** Stub Supabase de {@link ReportRepository} — implémentation prévue à l'étape 8. */
export function createSupabaseReportRepository(
  _client: SupabaseClient,
): ReportRepository {
  return {
    create: notImplementedMethod(STEP_MESSAGE),
    listMine: notImplementedMethod(STEP_MESSAGE),
    listAll: notImplementedMethod(STEP_MESSAGE),
    getById: notImplementedMethod(STEP_MESSAGE),
    updateStatus: notImplementedMethod(STEP_MESSAGE),
    updatePriority: notImplementedMethod(STEP_MESSAGE),
    assign: notImplementedMethod(STEP_MESSAGE),
    addComment: notImplementedMethod(STEP_MESSAGE),
    listEvents: notImplementedMethod(STEP_MESSAGE),
  };
}
