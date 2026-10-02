import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isProtectedPath } from "@/lib/auth/constants";

const APP_DIR = path.join(process.cwd(), "src", "app", "(app)");

/** Groupes `(x)`, slots `@x` et dossiers privés `_x` ne forment pas de segment d'URL. */
function isTransparentFolder(name: string): boolean {
  return /^\(.*\)$/.test(name) || name.startsWith("@") || name.startsWith("_");
}

/** Segments d'URL de premier niveau sous `dir` (en traversant les groupes de routes). */
function topLevelSegments(dir: string): string[] {
  const segments: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (isTransparentFolder(entry.name)) {
      segments.push(...topLevelSegments(path.join(dir, entry.name)));
    } else {
      segments.push(entry.name);
    }
  }
  return segments;
}

/** Segments dont le chemin n'est pas couvert par `PROTECTED_PATH_PREFIXES`. */
function findUncoveredSegments(
  segments: string[],
  isCovered: (pathname: string) => boolean,
): string[] {
  return segments.filter((segment) => !isCovered(`/${segment}`));
}

describe("garde-fou du middleware", () => {
  it("chaque segment de premier niveau de src/app/(app) est couvert par PROTECTED_PATH_PREFIXES", () => {
    const uncovered = findUncoveredSegments(
      topLevelSegments(APP_DIR),
      isProtectedPath,
    );
    expect(
      uncovered,
      `Route(s) de premier niveau non couverte(s) par le middleware : ${uncovered
        .map((segment) => `/${segment}`)
        .join(
          ", ",
        )}. Ajoutez-les à PROTECTED_PATH_PREFIXES dans src/lib/auth/constants.ts.`,
    ).toEqual([]);
  });

  it("détecte un segment non couvert (cas simulé)", () => {
    expect(
      findUncoveredSegments(["admin", "nouvelle-section"], isProtectedPath),
    ).toEqual(["nouvelle-section"]);
  });

  it("traverse les groupes de routes et ignore slots et dossiers privés", () => {
    expect(isTransparentFolder("(home)")).toBe(true);
    expect(isTransparentFolder("@modal")).toBe(true);
    expect(isTransparentFolder("_components")).toBe(true);
    expect(isTransparentFolder("admin")).toBe(false);
  });
});
