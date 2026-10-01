import type * as React from "react";

import { cn } from "@/lib/utils";

/** Bloc de chargement animé, utilisé le temps que le contenu réel arrive. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
