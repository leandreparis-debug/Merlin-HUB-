import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Conteneur centré à largeur maximale (≈1280px), avec des marges horizontales
 * adaptées au mobile, à la tablette et au desktop.
 */
export function PageContainer({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}
