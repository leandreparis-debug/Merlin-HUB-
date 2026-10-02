/** Message affiché quand l'annonce visée n'existe plus. */
export const ANNOUNCEMENT_GONE_MESSAGE = "Cette annonce n'existe plus.";

/**
 * Messages affichables d'après le paramètre `?notice=` de la liste des
 * annonces. Module partagé (et non un module « use client »).
 */
export const ANNOUNCEMENT_LIST_NOTICES: Record<string, string> = {
  deleted: "L'annonce a été supprimée.",
  gone: ANNOUNCEMENT_GONE_MESSAGE,
};

/** Messages affichables sur la fiche d'une annonce d'après `?notice=`. */
export const ANNOUNCEMENT_DETAIL_NOTICES: Record<string, string> = {
  created: "L'annonce a été créée.",
};
