import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  bundleMigrations,
  listMigrationFiles,
} from "../scripts/bundle-migrations";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function readMigration(file: string): string {
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8");
}

describe("migrations SQL (vérification statique)", () => {
  const files = listMigrationFiles(MIGRATIONS_DIR);

  it("liste au moins les 6 migrations attendues, triées par horodatage", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(files).toEqual([...files].sort());
  });

  it("chaque migration est lisible et non vide", () => {
    for (const file of files) {
      expect(readMigration(file).trim().length).toBeGreaterThan(0);
    }
  });

  it("chaque CREATE TABLE public.… a un ENABLE ROW LEVEL SECURITY correspondant", () => {
    const allSql = files.map(readMigration).join("\n");

    const tableNames = Array.from(
      allSql.matchAll(/create table if not exists public\.(\w+)/gi),
    )
      .map((match) => match[1])
      .filter((name): name is string => name !== undefined);

    expect(tableNames.length).toBeGreaterThan(0);

    for (const table of tableNames) {
      const rlsPattern = new RegExp(
        `alter table public\\.${table} enable row level security`,
        "i",
      );
      expect(allSql).toMatch(rlsPattern);
    }
  });

  it("aucune table n'a de policy FOR ALL TO anon", () => {
    const allSql = files.map(readMigration).join("\n");
    expect(allSql).not.toMatch(/to\s+anon\b/i);
  });

  it("chaque fonction SECURITY DEFINER définit search_path", () => {
    const allSql = files.map(readMigration).join("\n");

    const functionBlocks = allSql
      .split(/(?=create or replace function)/i)
      .slice(1);

    expect(functionBlocks.length).toBeGreaterThan(0);

    const securityDefinerBlocks = functionBlocks.filter((block) =>
      /security definer/i.test(block),
    );
    expect(securityDefinerBlocks.length).toBeGreaterThan(0);

    for (const block of securityDefinerBlocks) {
      expect(block).toMatch(/set search_path = ''/);
    }
  });
});

describe("migration published_at des annonces (statique)", () => {
  const file = "20261001000700_announcements_published_at.sql";
  const sql = () => readMigration(file);

  it("est additive : elle ne modifie pas la migration d'origine et passe après elle", () => {
    const files = listMigrationFiles(MIGRATIONS_DIR);
    expect(files).toContain(file);
    expect(files.indexOf(file)).toBeGreaterThan(
      files.indexOf("20261001000400_announcements.sql"),
    );
    expect(readMigration("20261001000400_announcements.sql")).toMatch(
      /published_at timestamptz not null default now\(\)/,
    );
  });

  it("rend published_at nullable, ajoute la contrainte et le trigger sécurisé", () => {
    expect(sql()).toMatch(/alter column published_at drop not null/i);
    expect(sql()).toMatch(/announcements_published_has_date/);
    expect(sql()).toMatch(/set search_path = ''/);
    expect(sql()).toMatch(/before insert or update on public\.announcements/i);
  });

  it("n'altère aucune policy RLS", () => {
    expect(sql()).not.toMatch(/create policy|drop policy|disable row level/i);
  });
});

describe("db:bundle", () => {
  it("contient toutes les migrations, dans l'ordre", () => {
    const bundle = bundleMigrations(MIGRATIONS_DIR);
    const files = listMigrationFiles(MIGRATIONS_DIR);

    let lastIndex = -1;
    for (const file of files) {
      const index = bundle.indexOf(file);
      expect(index).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });
});
