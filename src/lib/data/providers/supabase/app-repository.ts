import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { NotFoundError } from "@/lib/data/errors";
import { translateSupabaseError } from "@/lib/data/providers/supabase/errors";
import {
  appFromRow,
  appStatusEventFromRow,
  createAppInputToRow,
  updateAppInputToRow,
  type AppRow,
  type AppStatusEventRow,
} from "@/lib/data/providers/supabase/rows";
import type { AppRepository } from "@/lib/data/repositories/app-repository";

/**
 * Implémentation Supabase de {@link AppRepository}. `setStatus` et
 * `reorder` appellent les fonctions SQL `set_app_status` et `reorder_apps`
 * (transaction atomique côté base).
 */
export function createSupabaseAppRepository(
  client: SupabaseClient,
): AppRepository {
  return {
    async listVisible() {
      const { data, error } = await client
        .from("apps")
        .select("*")
        .eq("is_hidden", false)
        .order("sort_order", { ascending: true })
        .returns<AppRow[]>();

      if (error) throw translateSupabaseError(error, "Application");
      return (data ?? []).map(appFromRow);
    },

    async listAll() {
      const { data, error } = await client
        .from("apps")
        .select("*")
        .order("sort_order", { ascending: true })
        .returns<AppRow[]>();

      if (error) throw translateSupabaseError(error, "Application");
      return (data ?? []).map(appFromRow);
    },

    async getById(id) {
      const { data, error } = await client
        .from("apps")
        .select("*")
        .eq("id", id)
        .maybeSingle<AppRow>();

      if (error) throw translateSupabaseError(error, "Application");
      if (!data) throw new NotFoundError("Application", id);
      return appFromRow(data);
    },

    async getBySlug(slug) {
      const { data, error } = await client
        .from("apps")
        .select("*")
        .eq("slug", slug)
        .maybeSingle<AppRow>();

      if (error) throw translateSupabaseError(error, "Application");
      if (!data) throw new NotFoundError("Application", slug);
      return appFromRow(data);
    },

    async create(input) {
      const { data: maxRow } = await client
        .from("apps")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle<Pick<AppRow, "sort_order">>();

      const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;
      const row = { ...createAppInputToRow(input), sort_order: nextSortOrder };

      const { data, error } = await client
        .from("apps")
        .insert(row)
        .select("*")
        .single<AppRow>();

      if (error) throw translateSupabaseError(error, "Application");
      return appFromRow(data);
    },

    async update(id, patch) {
      const row = updateAppInputToRow(patch);
      const { data, error } = await client
        .from("apps")
        .update(row)
        .eq("id", id)
        .select("*")
        .maybeSingle<AppRow>();

      if (error) throw translateSupabaseError(error, "Application");
      if (!data) throw new NotFoundError("Application", id);
      return appFromRow(data);
    },

    async delete(id) {
      const { error, count } = await client
        .from("apps")
        .delete({ count: "exact" })
        .eq("id", id);

      if (error) throw translateSupabaseError(error, "Application");
      if (!count) throw new NotFoundError("Application", id);
    },

    async reorder(orderedIds) {
      const { error } = await client.rpc("reorder_apps", {
        p_ordered_ids: orderedIds,
      });
      if (error) throw translateSupabaseError(error, "Application");
    },

    async setStatus(id, status, options) {
      const { error } = await client.rpc("set_app_status", {
        p_app_id: id,
        p_new_status: status,
        p_note: options?.note ?? null,
        p_changed_by: options?.changedBy ?? null,
      });
      if (error) throw translateSupabaseError(error, "Application");

      const { data, error: selectError } = await client
        .from("apps")
        .select("*")
        .eq("id", id)
        .maybeSingle<AppRow>();

      if (selectError) throw translateSupabaseError(selectError, "Application");
      if (!data) throw new NotFoundError("Application", id);
      return appFromRow(data);
    },

    async listStatusEvents(appId, options) {
      const { data, error } = await client
        .from("app_status_events")
        .select("*")
        .eq("app_id", appId)
        .order("changed_at", { ascending: false })
        .limit(options?.limit ?? 50)
        .returns<AppStatusEventRow[]>();

      if (error) throw translateSupabaseError(error, "Historique de statut");
      return (data ?? []).map(appStatusEventFromRow);
    },

    async listRecentStatusEvents(options) {
      const { data, error } = await client
        .from("app_status_events")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(options?.limit ?? 50)
        .returns<AppStatusEventRow[]>();

      if (error) throw translateSupabaseError(error, "Historique de statut");
      return (data ?? []).map(appStatusEventFromRow);
    },
  };
}
