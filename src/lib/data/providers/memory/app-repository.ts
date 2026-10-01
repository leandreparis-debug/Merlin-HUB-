import {
  ConflictError,
  NotFoundError,
  ValidationError,
  validationErrorFromZod,
} from "@/lib/data/errors";
import type { MemoryStore } from "@/lib/data/providers/memory/store";
import type { AppRepository } from "@/lib/data/repositories/app-repository";
import { createAppInputSchema, updateAppInputSchema } from "@/lib/data/schemas";
import type { App, AppStatus } from "@/lib/data/types";

const ALLOWED_STATUSES: readonly AppStatus[] = [
  "online",
  "offline",
  "maintenance",
];

function findBySlug(
  store: MemoryStore,
  slug: string,
  excludeId?: string,
): App | undefined {
  for (const app of store.apps.values()) {
    if (app.slug === slug && app.id !== excludeId) return app;
  }
  return undefined;
}

function sortedBySortOrder(apps: App[]): App[] {
  return apps.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Implémentation mémoire de {@link AppRepository}, reproduisant les règles de `apps` et `app_status_events`. */
export function createMemoryAppRepository(store: MemoryStore): AppRepository {
  return {
    async listVisible() {
      return sortedBySortOrder(
        Array.from(store.apps.values()).filter((app) => !app.isHidden),
      );
    },

    async listAll() {
      return sortedBySortOrder(Array.from(store.apps.values()));
    },

    async getById(id) {
      const app = store.apps.get(id);
      if (!app) throw new NotFoundError("Application", id);
      return app;
    },

    async getBySlug(slug) {
      const app = findBySlug(store, slug);
      if (!app) throw new NotFoundError("Application", slug);
      return app;
    },

    async create(input) {
      const result = createAppInputSchema.safeParse(input);
      if (!result.success) {
        throw validationErrorFromZod(result.error, "Application invalide");
      }
      const data = result.data;

      if (findBySlug(store, data.slug)) {
        throw new ConflictError("Une application avec ce slug existe déjà");
      }

      const maxSortOrder = Array.from(store.apps.values()).reduce(
        (max, app) => Math.max(max, app.sortOrder),
        -1,
      );
      const now = store.now();

      const app: App = {
        id: store.nextId(),
        slug: data.slug,
        name: data.name,
        description: data.description ?? "",
        icon: data.icon ?? "app-window",
        category: data.category ?? "Général",
        url: data.url ?? null,
        version: data.version ?? null,
        isNew: data.isNew ?? false,
        ownerName: data.ownerName ?? null,
        ownerEmail: data.ownerEmail ?? null,
        docUrl: data.docUrl ?? null,
        status: "offline",
        statusMessage: null,
        statusUpdatedAt: now,
        sortOrder: maxSortOrder + 1,
        isHidden: data.isHidden ?? false,
        createdAt: now,
        updatedAt: now,
      };

      store.apps.set(app.id, app);
      return app;
    },

    async update(id, patch) {
      const existing = store.apps.get(id);
      if (!existing) throw new NotFoundError("Application", id);

      const result = updateAppInputSchema.safeParse(patch);
      if (!result.success) {
        throw validationErrorFromZod(result.error, "Application invalide");
      }
      const data = result.data;

      if (data.slug !== undefined && findBySlug(store, data.slug, id)) {
        throw new ConflictError("Une application avec ce slug existe déjà");
      }

      const updated: App = {
        ...existing,
        slug: data.slug !== undefined ? data.slug : existing.slug,
        name: data.name !== undefined ? data.name : existing.name,
        description:
          data.description !== undefined
            ? data.description
            : existing.description,
        icon: data.icon !== undefined ? data.icon : existing.icon,
        category:
          data.category !== undefined ? data.category : existing.category,
        url: data.url !== undefined ? data.url : existing.url,
        version: data.version !== undefined ? data.version : existing.version,
        isNew: data.isNew !== undefined ? data.isNew : existing.isNew,
        ownerName:
          data.ownerName !== undefined ? data.ownerName : existing.ownerName,
        ownerEmail:
          data.ownerEmail !== undefined ? data.ownerEmail : existing.ownerEmail,
        docUrl: data.docUrl !== undefined ? data.docUrl : existing.docUrl,
        isHidden:
          data.isHidden !== undefined ? data.isHidden : existing.isHidden,
        updatedAt: store.now(),
      };

      store.apps.set(id, updated);
      return updated;
    },

    async delete(id) {
      if (!store.apps.has(id)) throw new NotFoundError("Application", id);
      store.apps.delete(id);
      store.appStatusEvents = store.appStatusEvents.filter(
        (event) => event.appId !== id,
      );
    },

    async reorder(orderedIds) {
      const unknown = orderedIds.find((id) => !store.apps.has(id));
      if (unknown !== undefined) {
        throw new NotFoundError("Application", unknown);
      }

      const now = store.now();
      orderedIds.forEach((id, index) => {
        const app = store.apps.get(id);
        /* istanbul ignore next -- vérifié ci-dessus : id forcément connu */
        if (!app) return;
        store.apps.set(id, { ...app, sortOrder: index, updatedAt: now });
      });
    },

    async setStatus(id, status, options) {
      const existing = store.apps.get(id);
      if (!existing) throw new NotFoundError("Application", id);
      if (!ALLOWED_STATUSES.includes(status)) {
        throw new ValidationError(`Statut invalide : ${status}`, [
          { path: "status", message: "Statut invalide" },
        ]);
      }

      const note = options?.note ?? null;
      const previousStatus = existing.status;
      const statusChanged = previousStatus !== status;
      const now = store.now();

      const updated: App = {
        ...existing,
        status,
        statusMessage: note,
        statusUpdatedAt: statusChanged ? now : existing.statusUpdatedAt,
        updatedAt: now,
      };
      store.apps.set(id, updated);

      if (statusChanged) {
        store.appStatusEvents.push({
          id: store.nextId(),
          appId: id,
          previousStatus,
          newStatus: status,
          note,
          changedBy: options?.changedBy ?? null,
          changedAt: now,
        });
      }

      return updated;
    },

    async listStatusEvents(appId, options) {
      const limit = options?.limit ?? 50;
      return store.appStatusEvents
        .filter((event) => event.appId === appId)
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
        .slice(0, limit);
    },

    async listRecentStatusEvents(options) {
      const limit = options?.limit ?? 50;
      return [...store.appStatusEvents]
        .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
        .slice(0, limit);
    },
  };
}
