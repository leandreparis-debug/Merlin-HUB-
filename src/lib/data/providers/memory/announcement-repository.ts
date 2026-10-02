import { NotFoundError, validationErrorFromZod } from "@/lib/data/errors";
import type { MemoryStore } from "@/lib/data/providers/memory/store";
import type { AnnouncementRepository } from "@/lib/data/repositories/announcement-repository";
import {
  createAnnouncementInputSchema,
  updateAnnouncementInputSchema,
} from "@/lib/data/schemas";
import type { Announcement } from "@/lib/data/types";

/** Tri des annonces : épinglées, puis `publishedAt` décroissant (brouillons en dernier), puis `createdAt` décroissant. */
export function compareAnnouncements(a: Announcement, b: Announcement): number {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
  if (a.publishedAt !== b.publishedAt) {
    if (a.publishedAt === null) return 1;
    if (b.publishedAt === null) return -1;
    return a.publishedAt < b.publishedAt ? 1 : -1;
  }
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt < b.createdAt ? 1 : -1;
}

/** Implémentation mémoire de {@link AnnouncementRepository}, reproduisant la table `announcements` et son trigger `published_at`. */
export function createMemoryAnnouncementRepository(
  store: MemoryStore,
): AnnouncementRepository {
  function getOrThrow(id: string): Announcement {
    const found = store.announcements.get(id);
    if (!found) throw new NotFoundError("Annonce", id);
    return found;
  }

  function save(announcement: Announcement): Announcement {
    const saved: Announcement = {
      ...announcement,
      // Première publication uniquement : jamais écrasée ensuite.
      publishedAt:
        announcement.isPublished && announcement.publishedAt === null
          ? store.now()
          : announcement.publishedAt,
      updatedAt: store.now(),
    };
    store.announcements.set(saved.id, saved);
    return saved;
  }

  return {
    async listPublished(options) {
      const published = Array.from(store.announcements.values())
        .filter((announcement) => announcement.isPublished)
        .sort(compareAnnouncements);
      return options?.limit === undefined
        ? published
        : published.slice(0, options.limit);
    },

    async listAll() {
      return Array.from(store.announcements.values()).sort(
        compareAnnouncements,
      );
    },

    async getById(id) {
      return getOrThrow(id);
    },

    async create(input) {
      const result = createAnnouncementInputSchema.safeParse(input);
      if (!result.success) {
        throw validationErrorFromZod(result.error, "Annonce invalide");
      }
      const data = result.data;
      const now = store.now();

      const isPublished = data.isPublished ?? true;

      const announcement: Announcement = {
        id: store.nextId(),
        title: data.title,
        body: data.body,
        isPinned: data.isPinned ?? false,
        isPublished,
        publishedAt: isPublished ? now : null,
        createdBy: data.createdBy ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.announcements.set(announcement.id, announcement);
      return announcement;
    },

    async update(id, patch) {
      const existing = getOrThrow(id);
      const result = updateAnnouncementInputSchema
        .pick({ title: true, body: true })
        .safeParse(patch);
      if (!result.success) {
        throw validationErrorFromZod(result.error, "Annonce invalide");
      }
      const data = result.data;

      return save({
        ...existing,
        title: data.title ?? existing.title,
        body: data.body ?? existing.body,
      });
    },

    async setPinned(id, pinned) {
      return save({ ...getOrThrow(id), isPinned: pinned });
    },

    async setPublished(id, published) {
      return save({ ...getOrThrow(id), isPublished: published });
    },

    async delete(id) {
      getOrThrow(id);
      store.announcements.delete(id);
    },
  };
}
