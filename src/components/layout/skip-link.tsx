/**
 * Lien d'évitement : invisible par défaut, affiché au focus clavier (premier Tab),
 * pour permettre d'atteindre directement le contenu principal sans traverser l'en-tête.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
    >
      Aller au contenu
    </a>
  );
}
