import { beforeEach, describe, expect, it } from "vitest";

import type { AnnouncementRepository } from "@/lib/data/repositories/announcement-repository";

/** Laisse s'écouler du temps réel pour que deux horodatages consécutifs diffèrent. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 8));

/**
 * Suite de contrat réutilisable pour {@link AnnouncementRepository}, exécutée
 * contre n'importe quelle implémentation (`factory` doit renvoyer un
 * repository neuf, isolé, à chaque appel).
 */
export function runAnnouncementRepositoryContract(
  factory: () => AnnouncementRepository,
): void {
  describe("AnnouncementRepository (contrat)", () => {
    let repo: AnnouncementRepository;

    beforeEach(() => {
      repo = factory();
    });

    it("crée une annonce publiée par défaut, non épinglée, avec une date de publication", async () => {
      const created = await repo.create({ title: "  Titre  ", body: "Texte" });

      expect(created).toMatchObject({
        title: "Titre",
        body: "Texte",
        isPinned: false,
        isPublished: true,
      });
      expect(created.publishedAt).not.toBeNull();
      expect(await repo.getById(created.id)).toEqual(created);
    });

    it("crée un brouillon sans date de publication", async () => {
      const draft = await repo.create({
        title: "Brouillon",
        body: "Texte",
        isPublished: false,
      });

      expect(draft.isPublished).toBe(false);
      expect(draft.publishedAt).toBeNull();
    });

    it("refuse un titre ou un texte vide, trop long ou fait d'espaces", async () => {
      await expect(repo.create({ title: "   ", body: "ok" })).rejects.toThrow();
      await expect(
        repo.create({ title: "x".repeat(121), body: "ok" }),
      ).rejects.toThrow();
      await expect(
        repo.create({ title: "ok", body: " \n\t " }),
      ).rejects.toThrow();
      await expect(
        repo.create({ title: "ok", body: "x".repeat(2001) }),
      ).rejects.toThrow();
    });

    it("retire les caractères de contrôle et conserve les retours à la ligne", async () => {
      const created = await repo.create({
        title: "Titre\u0000",
        body: "Ligne 1\r\nLigne 2\u0007",
      });

      expect(created.title).toBe("Titre");
      expect(created.body).toBe("Ligne 1\nLigne 2");
    });

    it("listPublished exclut les brouillons ; listAll les inclut", async () => {
      await repo.create({ title: "Publiée", body: "a" });
      await repo.create({ title: "Brouillon", body: "b", isPublished: false });

      expect((await repo.listPublished()).map((a) => a.title)).toEqual([
        "Publiée",
      ]);
      expect(await repo.listAll()).toHaveLength(2);
    });

    it("trie les épinglées d'abord, puis par date de publication décroissante", async () => {
      const oldest = await repo.create({ title: "Ancienne", body: "a" });
      await tick();
      await repo.create({ title: "Récente", body: "b" });
      await tick();
      const pinned = await repo.create({ title: "Épinglée", body: "c" });
      await repo.setPinned(oldest.id, true);
      await repo.setPinned(pinned.id, true);

      const titles = (await repo.listPublished()).map((a) => a.title);
      // Les deux épinglées d'abord (la plus récemment publiée en premier).
      expect(titles).toEqual(["Épinglée", "Ancienne", "Récente"]);
    });

    it("listPublished respecte `limit`", async () => {
      await repo.create({ title: "A", body: "a" });
      await tick();
      await repo.create({ title: "B", body: "b" });
      await tick();
      await repo.create({ title: "C", body: "c" });

      expect(
        (await repo.listPublished({ limit: 2 })).map((a) => a.title),
      ).toEqual(["C", "B"]);
    });

    it("update modifie le titre et le texte sans toucher aux dates de publication", async () => {
      const created = await repo.create({ title: "Avant", body: "avant" });
      await tick();
      const updated = await repo.update(created.id, {
        title: "Après",
        body: "après",
      });

      expect(updated).toMatchObject({ title: "Après", body: "après" });
      expect(updated.publishedAt).toBe(created.publishedAt);
      expect(updated.isPublished).toBe(true);
    });

    it("l'épinglage ne modifie pas la date de publication ; il est idempotent", async () => {
      const created = await repo.create({ title: "T", body: "b" });
      await tick();
      const pinned = await repo.setPinned(created.id, true);
      const again = await repo.setPinned(created.id, true);
      const unpinned = await repo.setPinned(created.id, false);

      expect(pinned.isPinned).toBe(true);
      expect(again.isPinned).toBe(true);
      expect(unpinned.isPinned).toBe(false);
      expect(unpinned.publishedAt).toBe(created.publishedAt);
    });

    it("la date de première publication est posée au premier passage en publiée, puis conservée", async () => {
      const draft = await repo.create({
        title: "T",
        body: "b",
        isPublished: false,
      });
      await tick();

      const published = await repo.setPublished(draft.id, true);
      expect(published.publishedAt).not.toBeNull();
      await tick();

      const unpublished = await repo.setPublished(draft.id, false);
      expect(unpublished.isPublished).toBe(false);
      expect(unpublished.publishedAt).toBe(published.publishedAt);
      await tick();

      const republished = await repo.setPublished(draft.id, true);
      expect(republished.publishedAt).toBe(published.publishedAt);
      expect(await repo.setPublished(draft.id, true)).toEqual(republished);
    });

    it("une annonce dépubliée disparaît de listPublished mais reste dans listAll", async () => {
      const created = await repo.create({ title: "T", body: "b" });
      await repo.setPublished(created.id, false);

      expect(await repo.listPublished()).toHaveLength(0);
      expect(await repo.listAll()).toHaveLength(1);
    });

    it("delete supprime l'annonce ; un identifiant inconnu lève NotFoundError", async () => {
      const created = await repo.create({ title: "T", body: "b" });
      await repo.delete(created.id);

      expect(await repo.listAll()).toHaveLength(0);
      const unknown = crypto.randomUUID();
      for (const action of [
        () => repo.getById(unknown),
        () => repo.update(unknown, { title: "x" }),
        () => repo.setPinned(unknown, true),
        () => repo.setPublished(unknown, true),
        () => repo.delete(unknown),
      ]) {
        await expect(action()).rejects.toMatchObject({ name: "NotFoundError" });
      }
    });
  });
}
