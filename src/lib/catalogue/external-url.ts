const EMAIL_PATTERN = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;

/**
 * Retourne l'URL normalisée si (et seulement si) son protocole est `http:` ou
 * `https:`, sinon `null` (`javascript:`, `data:`, `ftp:`, chaîne vide, URL mal
 * formée…). Défense en profondeur : l'écriture est déjà validée, mais un lien
 * n'est affiché qu'après ce contrôle.
 */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Retourne l'email nettoyé s'il a une forme valide (utilisé pour construire un lien `mailto:`), sinon `null`. */
export function safeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  return trimmed && EMAIL_PATTERN.test(trimmed) ? trimmed : null;
}
