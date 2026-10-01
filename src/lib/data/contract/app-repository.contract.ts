import { beforeEach, describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "@/lib/data/errors";
import type { AppRepository } from "@/lib/data/repositories/app-repository";
import type { CreateAppInput } from "@/lib/data/types";

const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

function sampleApp(overrides: Partial<CreateAppInput> = {}): CreateAppInput {
  return {
    slug: "mon-app",
    name: "Mon application",
    ...overrides,
  };
}

/**
 * Suite de contrat réutilisable pour {@link AppRepository}, exécutée contre
 * n'importe quelle implémentation (`factory` doit renvoyer un repository
 * neuf, isolé, à chaque appel).
 */
export function runAppRepositoryContract(factory: () => AppRepository): void {
  describe("AppRepository (contrat)", () => {
    let repo: AppRepository;

    beforeEach(() => {
      repo = factory();
    });

    it("crée une application et lui attribue un sortOrder automatique", async () => {
      const first = await repo.create(
        sampleApp({ slug: "app-un", name: "App un" }),
      );
      const second = await repo.create(
        sampleApp({ slug: "app-deux", name: "App deux" }),
      );

      expect(first.sortOrder).toBe(0);
      expect(second.sortOrder).toBe(1);
      expect(first.status).toBe("offline");
      expect(first.id).toBeTruthy();
    });

    it("rejette un slug en doublon avec ConflictError", async () => {
      await repo.create(sampleApp({ slug: "doublon" }));
      await expect(
        repo.create(sampleApp({ slug: "doublon" })),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("lève NotFoundError pour un id inconnu", async () => {
      await expect(repo.getById(UNKNOWN_ID)).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("applique une mise à jour partielle", async () => {
      const app = await repo.create(sampleApp());
      const updated = await repo.update(app.id, { name: "Nouveau nom" });

      expect(updated.name).toBe("Nouveau nom");
      expect(updated.slug).toBe(app.slug);
    });

    it("supprime une application", async () => {
      const app = await repo.create(sampleApp());
      await repo.delete(app.id);

      await expect(repo.getById(app.id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("listVisible exclut les applications masquées", async () => {
      await repo.create(sampleApp({ slug: "visible", isHidden: false }));
      await repo.create(sampleApp({ slug: "masquee", isHidden: true }));

      const visible = await repo.listVisible();
      expect(visible.map((app) => app.slug)).toEqual(["visible"]);

      const all = await repo.listAll();
      expect(all).toHaveLength(2);
    });

    it("reorder applique le nouvel ordre", async () => {
      const a = await repo.create(sampleApp({ slug: "app-a" }));
      const b = await repo.create(sampleApp({ slug: "app-b" }));
      const c = await repo.create(sampleApp({ slug: "app-c" }));

      await repo.reorder([c.id, a.id, b.id]);

      const all = await repo.listAll();
      expect(all.map((app) => app.slug)).toEqual(["app-c", "app-a", "app-b"]);
    });

    it("reorder rejette un id inconnu sans modification partielle", async () => {
      const a = await repo.create(sampleApp({ slug: "app-a" }));
      const b = await repo.create(sampleApp({ slug: "app-b" }));

      await expect(
        repo.reorder([b.id, a.id, UNKNOWN_ID]),
      ).rejects.toBeInstanceOf(NotFoundError);

      const all = await repo.listAll();
      expect(all.map((app) => app.slug)).toEqual(["app-a", "app-b"]);
    });

    it("setStatus met à jour l'app et journalise un événement avec previousStatus correct", async () => {
      const app = await repo.create(sampleApp());
      const updated = await repo.setStatus(app.id, "online", {
        note: "Mise en service",
      });

      expect(updated.status).toBe("online");
      expect(updated.statusMessage).toBe("Mise en service");

      const events = await repo.listStatusEvents(app.id);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        previousStatus: "offline",
        newStatus: "online",
        note: "Mise en service",
      });
    });

    it("setStatus ne crée aucun événement si le statut est inchangé", async () => {
      const app = await repo.create(sampleApp());
      await repo.setStatus(app.id, "online");
      expect(await repo.listStatusEvents(app.id)).toHaveLength(1);

      await repo.setStatus(app.id, "online", { note: "Toujours en ligne" });
      const events = await repo.listStatusEvents(app.id);
      expect(events).toHaveLength(1);

      const updated = await repo.getById(app.id);
      expect(updated.statusMessage).toBe("Toujours en ligne");
    });
  });
}
