"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Message de confirmation affiché une seule fois : retire le paramètre
 * `notice` de l'URL après l'affichage pour qu'un rechargement ne le répète pas.
 */
export function NoticeBanner({ children }: { children: ReactNode }) {
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <div
      role="status"
      className="bg-status-online-bg text-status-online-text mb-6 rounded-md px-4 py-3 text-sm font-medium"
    >
      {children}
    </div>
  );
}
