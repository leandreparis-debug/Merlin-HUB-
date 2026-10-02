import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

/**
 * Champ de formulaire d'administration : libellé lié, aide et erreur associées
 * au contrôle par `aria-describedby` (ids `${id}-hint` et `${id}-error`).
 * `children` reçoit les props d'accessibilité à appliquer au contrôle.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": true | undefined;
  }) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-destructive text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Classes d'un `<select>` natif alignées sur `Input`. */
export const SELECT_CLASS =
  "border-input h-11 w-full rounded-md border bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive md:text-sm";
