import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { NotFoundError, validationErrorFromZod } from "@/lib/data/errors";
import { translateSupabaseError } from "@/lib/data/providers/supabase/errors";
import {
  announcementFromRow,
  createAnnouncementInputToRow,
  type AnnouncementRow,
} from "@/lib/data/providers/supabase/rows";
import type { AnnouncementRepository } from "@/lib/data/repositories/announcement-repository";
import {
  createAnnouncementInputSchema,
  updateAnnouncementInputSchema,
} from "@/lib/data/schemas";

const ENTITY = "Annonce";

/**
 * Implémentation Supabase de {@link AnnouncementRepository}. Le tri est
 * celui de l'index (épinglées, `published_at` décroissant, `created_at`
 * décroissant) ; `published_at` est posé par un trigger à la première
 * publication.
 */
export function createSupabaseAnnouncementRepository(
  client: SupabaseClient,
): AnnouncementRepository {
  const sorted = () =>
    client
      .from("announcements")
      .select("*")
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

  async function fetchById(id: string) {
    const { data, error } = await client
      .from("announcements")
      .select("*")
      .eq("id", id)
      .maybeSingle<AnnouncementRow>();

    if (error) throw translateSupabaseError(error, ENTITY);
    if (!data) throw new NotFoundError(ENTITY, id);
    return announcementFromRow(data);
  }

  async function patchRow(id: string, row: Partial<AnnouncementRow>) {
    const { data, error } = await client
      .from("announcements")
      .update(row)
      .eq("id", id)
      .select("*")
      .maybeSingle<AnnouncementRow>();

    if (error) throw translateSupabaseError(error, ENTITY);
    if (!data) throw new NotFoundError(ENTITY, id);
    return announcementFromRow(data);
  }

  return {
    async listPublished(options) {
      let query = sorted().eq("is_published", true);
      if (options?.limit !== undefined) query = query.limit(options.limit);
      const { data, error } = await query.returns<AnnouncementRow[]>();

      if (error) throw translateSupabaseError(error, ENTITY);
      return (data ?? []).map(announcementFromRow);
    },

    async listAll() {
      const { data, error } = await sorted().returns<AnnouncementRow[]>();

      if (error) throw translateSupabaseError(error, ENTITY);
      return (data ?? []).map(announcementFromRow);
    },

    getById: fetchById,

    async create(input) {
      const result = createAnnouncementInputSchema.safeParse(input);
      if (!result.success) {
        throw validationErrorFromZod(result.error, "Annonce invalide");
      }
      const { data, error } = await client
        .from("announcements")
        .insert(createAnnouncementInputToRow(result.data))
        .select("*")
        .single<AnnouncementRow>();

      if (error) throw translateSupabaseError(error, ENTITY);
      return announcementFromRow(data);
    },

    async update(id, patch) {
      const result = updateAnnouncementInputSchema
        .pick({ title: true, body: true })
        .safeParse(patch);
      if (!result.success) {
        throw validationErrorFromZod(result.error, "Annonce invalide");
      }
      const row: Partial<AnnouncementRow> = {};
      if (result.data.title !== undefined) row.title = result.data.title;
      if (result.data.body !== undefined) row.body = result.data.body;
      if (Object.keys(row).length === 0) return fetchById(id);
      return patchRow(id, row);
    },

    async setPinned(id, pinned) {
      return patchRow(id, { is_pinned: pinned });
    },

    async setPublished(id, published) {
      return patchRow(id, { is_published: published });
    },

    async delete(id) {
      const { error, count } = await client
        .from("announcements")
        .delete({ count: "exact" })
        .eq("id", id);

      if (error) throw translateSupabaseError(error, ENTITY);
      if (!count) throw new NotFoundError(ENTITY, id);
    },
  };
}
