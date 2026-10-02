import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ADMIN_DIR = path.join(process.cwd(), "src", "app", "(app)", "admin");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(ADMIN_DIR);
const read = (file: string) => fs.readFileSync(file, "utf8");
const rel = (file: string) => path.relative(ADMIN_DIR, file);

describe("garde-fous statiques de l'administration", () => {
  it("le layout et chaque page d'administration appellent requireAdmin()", () => {
    const targets = files.filter((file) =>
      /(?:^|[\\/])(layout|page)\.tsx$/.test(file),
    );
    expect(targets.length).toBeGreaterThanOrEqual(8);
    const missing = targets
      .filter((file) => !read(file).includes("await requireAdmin()"))
      .map(rel);
    expect(
      missing,
      `Ces fichiers doivent appeler requireAdmin() eux-mêmes : ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("chaque server action appelle requireAdmin() avant tout accès aux données", () => {
    const actionFiles = files.filter((file) => /actions\.ts$/.test(file));
    expect(actionFiles.length).toBeGreaterThan(0);

    for (const file of actionFiles) {
      const source = read(file);
      expect(source.startsWith('"use server"')).toBe(true);
      const chunks = source.split("export async function ").slice(1);
      expect(chunks.length).toBeGreaterThan(0);
      for (const chunk of chunks) {
        const name = chunk.slice(0, chunk.indexOf("("));
        const guard = chunk.indexOf("await requireAdmin()");
        const data = chunk.indexOf("getAdminRepositories(");
        expect(guard, `${name} doit appeler requireAdmin()`).toBeGreaterThan(
          -1,
        );
        if (data !== -1) {
          expect(
            guard,
            `${name} doit appeler requireAdmin() avant getAdminRepositories()`,
          ).toBeLessThan(data);
        }
      }
    }
  });

  it("aucun composant n'appelle getAdminRepositories() (réservé aux actions et chargeurs d'admin)", () => {
    const componentsDir = path.join(process.cwd(), "src", "components");
    const offenders = walk(componentsDir)
      .filter((file) => /\.tsx?$/.test(file))
      .filter((file) =>
        /getAdminRepositories|getAccountAdminService/.test(read(file)),
      )
      .map((file) => path.relative(componentsDir, file));
    expect(offenders).toEqual([]);
  });
});
