"use client";

import { AppIcon } from "@/components/catalogue/app-icon";
import { ICON_NAMES } from "@/lib/catalogue/icons";

/**
 * Sélecteur d'icône : grille de boutons radio (accessible au clavier, flèches
 * natives) basée sur la liste exportée du registre d'icônes.
 */
export function IconPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (name: string) => void;
  error?: string | undefined;
}) {
  return (
    <fieldset
      aria-describedby={error ? "icon-error" : "icon-hint"}
      aria-invalid={error ? true : undefined}
      className="space-y-2"
    >
      <legend className="text-sm leading-none font-medium">Icône</legend>
      <div
        role="radiogroup"
        aria-label="Icône de l'application"
        className="grid max-h-56 grid-cols-6 gap-2 overflow-y-auto rounded-md border p-2 sm:grid-cols-8"
      >
        {ICON_NAMES.map((name) => (
          <label
            key={name}
            title={name}
            className="hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-accent has-[:checked]:text-accent-foreground has-[:focus-visible]:ring-ring/50 flex size-11 cursor-pointer items-center justify-center rounded-md border border-transparent has-[:focus-visible]:ring-[3px]"
          >
            <input
              type="radio"
              name="icon"
              value={name}
              checked={value === name}
              onChange={() => onChange(name)}
              className="sr-only"
            />
            <AppIcon name={name} className="size-5" />
            <span className="sr-only">{name}</span>
          </label>
        ))}
      </div>
      <p id="icon-hint" className="text-muted-foreground text-xs">
        Icône sélectionnée : {value}
      </p>
      {error ? (
        <p id="icon-error" className="text-destructive text-sm font-medium">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
