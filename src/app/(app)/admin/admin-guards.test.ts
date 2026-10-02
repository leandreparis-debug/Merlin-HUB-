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

/** Violations du contrat « requireAdmin() en premier » dans le source d'un fichier d'actions. */
function findActionViolations(source: string): string[] {
  const violations: string[] = [];
  if (!source.startsWith('"use server"')) {
    violations.push('le fichier doit commencer par "use server"');
  }
  for (const chunk of source.split("export async function ").slice(1)) {
    const name = chunk.slice(0, chunk.indexOf("("));
    const guard = chunk.indexOf("await requireAdmin()");
    const data = chunk.indexOf("getAdminRepositories(");
    if (guard === -1) {
      violations.push(`${name} doit appeler requireAdmin()`);
    } else if (data !== -1 && guard > data) {
      violations.push(
        `${name} doit appeler requireAdmin() avant getAdminRepositories()`,
      );
    }
  }
  return violations;
}

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
      expect(findActionViolations(read(file)), rel(file)).toEqual([]);
    }
  });

  it("le garde-fou des actions échoue sur une action sans requireAdmin() (cas simulé)", () => {
    const unguarded = [
      '"use server"',
      "export async function leakAction() {",
      "  const repos = getAdminRepositories();",
      "  return repos.announcements.listAll();",
      "}",
    ].join("\n");
    expect(findActionViolations(unguarded)).toEqual([
      "leakAction doit appeler requireAdmin()",
    ]);

    const lateGuard = [
      '"use server"',
      "export async function lateAction() {",
      "  getAdminRepositories();",
      "  await requireAdmin();",
      "}",
    ].join("\n");
    expect(findActionViolations(lateGuard)).toEqual([
      "lateAction doit appeler requireAdmin() avant getAdminRepositories()",
    ]);
  });

  it("les actions et pages des annonces sont bien parcourues par le garde-fou", () => {
    expect(files.map(rel)).toEqual(
      expect.arrayContaining([
        path.join("announcements", "actions.ts"),
        path.join("announcements", "page.tsx"),
        path.join("announcements", "new", "page.tsx"),
        path.join("announcements", "[id]", "page.tsx"),
      ]),
    );
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
