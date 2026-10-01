import type {
  Announcement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "@/lib/data/types";

/**
 * Accès aux annonces épinglables. Interface posée à l'étape 2 ; les
 * implémentations (Supabase et mémoire) sont ajoutées à l'étape 7.
 */
export interface AnnouncementRepository {
  /** Annonces publiées par défaut, triées par épinglage puis date de publication. `includeUnpublished` inclut aussi les brouillons. */
  list(options?: { includeUnpublished?: boolean }): Promise<Announcement[]>;
  /** Lève {@link NotFoundError} si `id` est inconnu. */
  getById(id: string): Promise<Announcement>;
  create(input: CreateAnnouncementInput): Promise<Announcement>;
  /** Applique un correctif partiel. Lève {@link NotFoundError} si `id` est inconnu. */
  update(id: string, patch: UpdateAnnouncementInput): Promise<Announcement>;
  /** Lève {@link NotFoundError} si `id` est inconnu. */
  delete(id: string): Promise<void>;
}
