"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Sections de l'administration : ajouter ici une entrée par nouvelle section (utilisateurs, annonces, …). */
export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Tableau de bord", exact: true },
  { href: "/admin/apps", label: "Applications", exact: false },
  { href: "/admin/users", label: "Utilisateurs", exact: false },
  { href: "/admin/announcements", label: "Annonces", exact: false },
] as const;

/** Sous-navigation de l'administration ; la page courante porte `aria-current="page"`. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administration" className="border-border mt-4 border-b">
      <ul className="-mb-px flex flex-wrap gap-1">
        {ADMIN_SECTIONS.map((section) => {
          const current = section.exact
            ? pathname === section.href
            : pathname === section.href ||
              pathname.startsWith(`${section.href}/`);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 inline-flex min-h-11 items-center rounded-t-md border-b-2 px-4 text-sm font-medium outline-none focus-visible:ring-[3px]",
                  current
                    ? "border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
