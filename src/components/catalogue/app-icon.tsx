import { resolveIcon } from "@/lib/catalogue/icons";

/** Icône d'une application d'après le registre (repli `app-window`), purement décorative. */
export function AppIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = resolveIcon(name);
  return <Icon aria-hidden="true" className={className} />;
}
