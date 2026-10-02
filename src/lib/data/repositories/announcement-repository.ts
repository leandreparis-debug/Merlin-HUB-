import type {
  Announcement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from "@/lib/data/types";

/**
 * Accès aux annonces épinglables (texte brut). Tri commun : épinglées
 * d'abord, puis `publishedAt` décroissant, puis `createdAt` décroissant.
 * `publishedAt` est posé à la première publication uniquement.
 */
export interface AnnouncementRepository {
  /** Annonces publiées uniquement (jamais de brouillon), triées ; `limit` borne le nombre de résultats. */
  listPublished(options?: { limit?: number }): Promise<Announcement[]>;
  /** Toutes les annonces, brouillons compris (usage administrateur), même tri. */
  listAll(): Promise<Announcement[]>;
  /** Lève {@link NotFoundError} si `id` est inconnu. */
  getById(id: string): Promise<Announcement>;
  create(input: CreateAnnouncementInput): Promise<Announcement>;
  /** Modifie le titre et/ou le texte, sans toucher aux dates de publication. Lève {@link NotFoundError} si `id` est inconnu. */
  update(
    id: string,
    patch: Pick<UpdateAnnouncementInput, "title" | "body">,
  ): Promise<Announcement>;
  /** Épingle ou désépingle (valeur explicite, idempotent). Lève {@link NotFoundError} si `id` est inconnu. */
  setPinned(id: string, pinned: boolean): Promise<Announcement>;
  /** Publie ou dépublie (valeur explicite, idempotent) ; la date de première publication est conservée. Lève {@link NotFoundError} si `id` est inconnu. */
  setPublished(id: string, published: boolean): Promise<Announcement>;
  /** Lève {@link NotFoundError} si `id` est inconnu. */
  delete(id: string): Promise<void>;
}
