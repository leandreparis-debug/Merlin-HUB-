import { beforeEach, describe, expect, it } from "vitest";

import type { ActivityLogRepository } from "@/lib/data/repositories/activity-log-repository";

/**
 * Suite de contrat réutilisable pour {@link ActivityLogRepository}, exécutée
 * contre n'importe quelle implémentation (`factory` doit renvoyer un
 * repository neuf, isolé, à chaque appel).
 */
export function runActivityLogRepositoryContract(
  factory: () => ActivityLogRepository,
): void {
  describe("ActivityLogRepository (contrat)", () => {
    let repo: ActivityLogRepository;

    beforeEach(() => {
      repo = factory();
    });

    it("record ne lève jamais, même avec une entrée invalide", async () => {
      await expect(
        repo.record({ action: "FORMAT INVALIDE !!" }),
      ).resolves.toBeUndefined();

      // Une entrée invalide n'est pas enregistrée : la validation a échoué
      // silencieusement, comme documenté.
      expect(await repo.list()).toHaveLength(0);
    });

    it("list trie par date décroissante", async () => {
      await repo.record({ action: "auth.login" });
      await repo.record({ action: "auth.logout" });

      const entries = await repo.list();
      expect(entries.length).toBeGreaterThanOrEqual(2);

      const [first, second] = entries;
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(first!.createdAt >= second!.createdAt).toBe(true);
    });

    it("list filtre par acteur et par action", async () => {
      const actorId = crypto.randomUUID();
      await repo.record({ action: "app.status_changed", actorId });
      await repo.record({ action: "auth.login" });

      const byActor = await repo.list({ actorId });
      expect(byActor.length).toBeGreaterThan(0);
      expect(byActor.every((entry) => entry.actorId === actorId)).toBe(true);

      const byAction = await repo.list({ action: "auth.login" });
      expect(byAction.length).toBeGreaterThan(0);
      expect(byAction.every((entry) => entry.action === "auth.login")).toBe(
        true,
      );
    });
  });
}
