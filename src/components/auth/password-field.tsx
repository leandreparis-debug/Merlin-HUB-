"use client";

import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Champ mot de passe avec libellé et bouton accessible d'affichage/masquage. */
export function PasswordField({
  id,
  label,
  hint,
  ref,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & {
  id: string;
  label: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          ref={ref}
          type={visible ? "text" : "password"}
          aria-describedby={hintId}
          className="pr-24"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-pressed={visible}
          aria-label={
            visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 rounded-md px-3 text-xs font-medium outline-none focus-visible:ring-[3px]"
        >
          {visible ? "Masquer" : "Afficher"}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
