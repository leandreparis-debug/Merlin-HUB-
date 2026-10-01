import { beforeEach, describe, expect, it } from "vitest";

import { NotFoundError } from "@/lib/data/errors";
import type { ProfileRepository } from "@/lib/data/repositories/profile-repository";
import type { CreateProfileInput, Profile } from "@/lib/data/types";

const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

/** Dépendances fournies par l'implémentation testée : le repository, et un moyen de créer un profil (le trigger Supabase n'a pas d'équivalent générique). */
export interface ProfileRepositoryContractContext {
  repo: ProfileRepository;
  createProfile: (input: CreateProfileInput) => Promise<Profile>;
}

/**
 * Suite de contrat réutilisable pour {@link ProfileRepository}, exécutée
 * contre n'importe quelle implémentation (`factory` doit renvoyer un
 * contexte neuf, isolé, à chaque appel).
 */
export function runProfileRepositoryContract(
  factory: () => ProfileRepositoryContractContext,
): void {
  describe("ProfileRepository (contrat)", () => {
    let ctx: ProfileRepositoryContractContext;

    beforeEach(() => {
      ctx = factory();
    });

    it("recherche par email insensible à la casse", async () => {
      const created = await ctx.createProfile({
        id: crypto.randomUUID(),
        email: "user@example.com",
      });

      const found = await ctx.repo.getByEmail("USER@EXAMPLE.COM");
      expect(found.id).toBe(created.id);
    });

    it("lève NotFoundError pour un id inconnu", async () => {
      await expect(ctx.repo.getById(UNKNOWN_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("countActiveAdmins ne compte que les admins actifs", async () => {
      const admin = await ctx.createProfile({
        id: crypto.randomUUID(),
        email: "admin@example.com",
        role: "admin",
      });
      await ctx.createProfile({
        id: crypto.randomUUID(),
        email: "user@example.com",
        role: "user",
      });

      expect(await ctx.repo.countActiveAdmins()).toBe(1);

      await ctx.repo.update(admin.id, { isActive: false });
      expect(await ctx.repo.countActiveAdmins()).toBe(0);
    });

    it("list filtre les comptes inactifs par défaut", async () => {
      const profile = await ctx.createProfile({
        id: crypto.randomUUID(),
        email: "inactive@example.com",
      });
      await ctx.repo.update(profile.id, { isActive: false });

      expect(await ctx.repo.list()).toHaveLength(0);
      expect(await ctx.repo.list({ includeInactive: true })).toHaveLength(1);
    });

    it("update applique lastLoginAt", async () => {
      const profile = await ctx.createProfile({
        id: crypto.randomUUID(),
        email: "login@example.com",
      });
      const now = new Date().toISOString();

      const updated = await ctx.repo.update(profile.id, { lastLoginAt: now });
      expect(updated.lastLoginAt).toBe(now);
    });
  });
}
