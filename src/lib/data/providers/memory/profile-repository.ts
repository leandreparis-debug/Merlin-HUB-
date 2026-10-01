import {
  ConflictError,
  NotFoundError,
  validationErrorFromZod,
} from "@/lib/data/errors";
import { createProfileInputSchema } from "@/lib/data/schemas";
import type { MemoryStore } from "@/lib/data/providers/memory/store";
import type { ProfileRepository } from "@/lib/data/repositories/profile-repository";
import type { CreateProfileInput, Profile } from "@/lib/data/types";

/** {@link ProfileRepository} de l'implémentation mémoire, avec une méthode supplémentaire réservée aux tests. */
export interface MemoryProfileRepository extends ProfileRepository {
  /**
   * Crée directement un profil, sans passer par le trigger Supabase
   * `handle_new_user` (qui n'a pas d'équivalent en mémoire). Réservé aux
   * tests : en production, un profil est toujours créé par ce trigger.
   */
  createForTests(input: CreateProfileInput): Promise<Profile>;
}

function findByEmail(store: MemoryStore, email: string): Profile | undefined {
  const normalized = email.trim().toLowerCase();
  for (const profile of store.profiles.values()) {
    if (profile.email === normalized) return profile;
  }
  return undefined;
}

/** Implémentation mémoire de {@link ProfileRepository}, reproduisant les règles de `profiles`. */
export function createMemoryProfileRepository(
  store: MemoryStore,
): MemoryProfileRepository {
  return {
    async getById(id) {
      const profile = store.profiles.get(id);
      if (!profile) throw new NotFoundError("Profil", id);
      return profile;
    },

    async getByEmail(email) {
      const profile = findByEmail(store, email);
      if (!profile) throw new NotFoundError("Profil", email);
      return profile;
    },

    async list(options) {
      const all = Array.from(store.profiles.values());
      const filtered = options?.includeInactive
        ? all
        : all.filter((profile) => profile.isActive);
      return filtered.sort((a, b) => a.email.localeCompare(b.email));
    },

    async update(id, patch) {
      const existing = store.profiles.get(id);
      if (!existing) throw new NotFoundError("Profil", id);

      const updated: Profile = {
        ...existing,
        fullName:
          patch.fullName !== undefined ? patch.fullName : existing.fullName,
        role: patch.role !== undefined ? patch.role : existing.role,
        isActive:
          patch.isActive !== undefined ? patch.isActive : existing.isActive,
        mustChangePassword:
          patch.mustChangePassword !== undefined
            ? patch.mustChangePassword
            : existing.mustChangePassword,
        lastLoginAt:
          patch.lastLoginAt !== undefined
            ? patch.lastLoginAt
            : existing.lastLoginAt,
        updatedAt: store.now(),
      };

      store.profiles.set(id, updated);
      return updated;
    },

    async countActiveAdmins() {
      let count = 0;
      for (const profile of store.profiles.values()) {
        if (profile.role === "admin" && profile.isActive) count += 1;
      }
      return count;
    },

    async createForTests(input) {
      const result = createProfileInputSchema.safeParse(input);
      if (!result.success) {
        throw validationErrorFromZod(result.error, "Profil invalide");
      }
      const data = result.data;

      if (store.profiles.has(data.id)) {
        throw new ConflictError("Un profil avec cet identifiant existe déjà");
      }
      if (findByEmail(store, data.email)) {
        throw new ConflictError("Un profil avec cet email existe déjà");
      }

      const now = store.now();
      const profile: Profile = {
        id: data.id,
        email: data.email,
        fullName: data.fullName ?? null,
        role: data.role ?? "user",
        mustChangePassword: true,
        isActive: true,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      };

      store.profiles.set(profile.id, profile);
      return profile;
    },
  };
}
