import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { NotFoundError } from "@/lib/data/errors";
import { translateSupabaseError } from "@/lib/data/providers/supabase/errors";
import {
  profileFromRow,
  updateProfileInputToRow,
  type ProfileRow,
} from "@/lib/data/providers/supabase/rows";
import type { ProfileRepository } from "@/lib/data/repositories/profile-repository";

/** Implémentation Supabase de {@link ProfileRepository}. */
export function createSupabaseProfileRepository(
  client: SupabaseClient,
): ProfileRepository {
  return {
    async getById(id) {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle<ProfileRow>();

      if (error) throw translateSupabaseError(error, "Profil");
      if (!data) throw new NotFoundError("Profil", id);
      return profileFromRow(data);
    },

    async getByEmail(email) {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle<ProfileRow>();

      if (error) throw translateSupabaseError(error, "Profil");
      if (!data) throw new NotFoundError("Profil", email);
      return profileFromRow(data);
    },

    async list(options) {
      let query = client
        .from("profiles")
        .select("*")
        .order("email", { ascending: true });
      if (!options?.includeInactive) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query.returns<ProfileRow[]>();
      if (error) throw translateSupabaseError(error, "Profil");
      return (data ?? []).map(profileFromRow);
    },

    async update(id, patch) {
      const row = updateProfileInputToRow(patch);
      const { data, error } = await client
        .from("profiles")
        .update(row)
        .eq("id", id)
        .select("*")
        .maybeSingle<ProfileRow>();

      if (error) throw translateSupabaseError(error, "Profil");
      if (!data) throw new NotFoundError("Profil", id);
      return profileFromRow(data);
    },

    async countActiveAdmins() {
      const { count, error } = await client
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true);

      if (error) throw translateSupabaseError(error, "Profil");
      return count ?? 0;
    },
  };
}
