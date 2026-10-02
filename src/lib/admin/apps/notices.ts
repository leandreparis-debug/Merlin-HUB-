import { APP_GONE_MESSAGE } from "@/lib/admin/apps/action-result";

/**
 * Messages affichables d'après le paramètre `?notice=` de la liste des
 * applications. Module serveur/partagé (et non un module « use client », dont
 * les exports non-composants ne sont pas utilisables côté serveur).
 */
export const LIST_NOTICES: Record<string, string> = {
  deleted: "L'application a été supprimée.",
  gone: APP_GONE_MESSAGE,
};
