import type { MetadataRoute } from "next";

/** Interdit l'indexation du site par les robots (outil interne non public). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
