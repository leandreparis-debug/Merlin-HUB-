/**
 * Concatène, dans l'ordre, toutes les migrations de `supabase/migrations/`
 * vers `supabase/all-in-one.sql` — pratique pour coller le schéma complet
 * dans le SQL Editor Supabase quand la CLI Supabase n'est pas utilisée
 * (voir docs/SUPABASE-SETUP.md). Exécuté via `npm run db:bundle`.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const OUTPUT_PATH = join(process.cwd(), "supabase", "all-in-one.sql");

/** Liste les fichiers de migration, triés par nom (donc par horodatage). */
export function listMigrationFiles(migrationsDir = MIGRATIONS_DIR): string[] {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

/** Construit le contenu du bundle à partir des fichiers de migration. */
export function bundleMigrations(migrationsDir = MIGRATIONS_DIR): string {
  const files = listMigrationFiles(migrationsDir);

  const header =
    '-- Fichier généré par "npm run db:bundle" — NE PAS MODIFIER À LA MAIN.\n' +
    "-- Concatène, dans l'ordre, les migrations de supabase/migrations/.\n" +
    "-- Usage : coller ce fichier dans le SQL Editor Supabase (voir docs/SUPABASE-SETUP.md).\n";

  const parts = files.map((file) => {
    const content = readFileSync(join(migrationsDir, file), "utf8");
    return `-- ===== ${file} =====\n${content.trimEnd()}\n`;
  });

  return [header, ...parts].join("\n");
}

function main(): void {
  const bundle = bundleMigrations();
  writeFileSync(OUTPUT_PATH, bundle, "utf8");
  console.log(
    `Bundle généré : ${OUTPUT_PATH} (${listMigrationFiles().length} migrations).`,
  );
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  main();
}
