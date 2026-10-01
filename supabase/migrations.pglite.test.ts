/**
 * Validation des migrations contre un vrai moteur Postgres (PGlite, WASM) :
 * un faux schéma `auth` minimal est créé (table `auth.users`, fonction
 * `auth.uid()` lisant `current_setting('request.jwt.claim.sub', true)`,
 * rôles `authenticated`/`anon`/`service_role`), puis toutes les migrations
 * et `seed.sql` sont appliquées. Les tests vérifient ensuite le
 * comportement réel de la RLS et des fonctions SQL, rôle par rôle.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listMigrationFiles } from "../scripts/bundle-migrations";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
const SEED_PATH = join(process.cwd(), "supabase", "seed.sql");

let db: PGlite;

/** Exécute `fn` avec le rôle Postgres et le claim JWT `sub` donnés, puis revient au rôle par défaut. */
async function asRole<T>(
  role: "authenticated" | "anon" | "service_role",
  sub: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(`set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false);", [
    sub ?? "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

/** Crée un utilisateur Auth (déclenche `handle_new_user`) et renvoie son id. */
async function createAuthUser(
  email: string,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const result = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id;",
    [email, JSON.stringify(metadata)],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Échec de création de l'utilisateur de test.");
  return row.id;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });

  // Faux schéma `auth`, limité à ce dont nos migrations ont besoin.
  await db.exec(`
    create extension if not exists pgcrypto;

    create schema auth;

    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );

    create or replace function auth.uid() returns uuid
    language sql stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    create role authenticated nologin;
    create role anon nologin;
    create role service_role nologin bypassrls;
  `);

  for (const file of listMigrationFiles(MIGRATIONS_DIR)) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await db.exec(sql);
  }

  // GRANTs de base que Supabase applique lui-même sur un vrai projet (nos
  // migrations ne les incluent pas : elles ne définissent que les policies
  // RLS, qui restent l'unique ligne de défense réelle).
  await db.exec(`
    grant usage on schema public to authenticated, anon, service_role;
    grant select, insert, update, delete on all tables in schema public
      to authenticated;
    grant select on all tables in schema public to anon;
    grant all on all tables in schema public to service_role;
  `);

  await db.exec(readFileSync(SEED_PATH, "utf8"));
});

afterAll(async () => {
  await db.close();
});

describe("trigger handle_new_user", () => {
  it("crée un profil avec le rôle 'user', même si les métadonnées réclament 'admin'", async () => {
    const userId = await createAuthUser("trigger-test@example.com", {
      full_name: "Trigger Test",
      role: "admin",
    });

    const { rows } = await db.query<{
      role: string;
      full_name: string;
      email: string;
    }>("select role, full_name, email from public.profiles where id = $1;", [
      userId,
    ]);

    expect(rows[0]).toMatchObject({
      role: "user",
      full_name: "Trigger Test",
      email: "trigger-test@example.com",
    });
  });
});

describe("RLS — profils et applications", () => {
  it("un utilisateur simple ne voit pas une app masquée ni les profils des autres", async () => {
    const aliceId = await createAuthUser("alice@example.com");
    const bobId = await createAuthUser("bob@example.com");

    await db.query(
      "insert into public.apps (slug, name, is_hidden) values ($1, $2, true);",
      ["app-masquee-rls", "App masquée"],
    );
    await db.query(
      "insert into public.apps (slug, name, is_hidden) values ($1, $2, false);",
      ["app-visible-rls", "App visible"],
    );

    const visibleSlugs = await asRole("authenticated", aliceId, async () => {
      const { rows } = await db.query<{ slug: string }>(
        "select slug from public.apps where slug in ($1, $2);",
        ["app-masquee-rls", "app-visible-rls"],
      );
      return rows.map((row) => row.slug);
    });

    expect(visibleSlugs).toEqual(["app-visible-rls"]);

    const visibleProfiles = await asRole("authenticated", aliceId, async () => {
      const { rows } = await db.query<{ id: string }>(
        "select id from public.profiles where id in ($1, $2);",
        [aliceId, bobId],
      );
      return rows.map((row) => row.id);
    });

    expect(visibleProfiles).toEqual([aliceId]);
  });

  it("un utilisateur simple ne peut pas modifier apps ni son propre role", async () => {
    const carolId = await createAuthUser("carol@example.com");
    const { rows: appRows } = await db.query<{ id: string }>(
      "insert into public.apps (slug, name) values ($1, $2) returning id;",
      ["app-protegee-rls", "App protégée"],
    );
    const appRow = appRows[0];
    if (!appRow) throw new Error("App de test non créée.");

    await asRole("authenticated", carolId, async () => {
      await db.query("update public.apps set name = $1 where id = $2;", [
        "Piratée",
        appRow.id,
      ]);
      await db.query(
        "update public.profiles set role = 'admin' where id = $1;",
        [carolId],
      );
    });

    const { rows: checkApp } = await db.query<{ name: string }>(
      "select name from public.apps where id = $1;",
      [appRow.id],
    );
    expect(checkApp[0]?.name).toBe("App protégée");

    const { rows: checkProfile } = await db.query<{ role: string }>(
      "select role from public.profiles where id = $1;",
      [carolId],
    );
    expect(checkProfile[0]?.role).toBe("user");
  });

  it("un admin voit et modifie tout", async () => {
    const adminId = await createAuthUser("admin-rls@example.com");
    await db.query("update public.profiles set role = 'admin' where id = $1;", [
      adminId,
    ]);

    const { rows: appRows } = await db.query<{ id: string }>(
      "insert into public.apps (slug, name, is_hidden) values ($1, $2, true) returning id;",
      ["app-admin-rls", "App visible admin seulement"],
    );
    const appRow = appRows[0];
    if (!appRow) throw new Error("App de test non créée.");

    const visibleAsAdmin = await asRole("authenticated", adminId, async () => {
      const { rows } = await db.query<{ id: string }>(
        "select id from public.apps where id = $1;",
        [appRow.id],
      );
      return rows;
    });
    expect(visibleAsAdmin).toHaveLength(1);

    await asRole("authenticated", adminId, async () => {
      await db.query("update public.apps set name = $1 where id = $2;", [
        "Renommée par un admin",
        appRow.id,
      ]);
    });

    const { rows: checkApp } = await db.query<{ name: string }>(
      "select name from public.apps where id = $1;",
      [appRow.id],
    );
    expect(checkApp[0]?.name).toBe("Renommée par un admin");
  });
});

describe("RLS — signalements", () => {
  it("un utilisateur peut créer un signalement à son nom mais pas au nom d'un autre", async () => {
    const daveId = await createAuthUser("dave@example.com");
    const erinId = await createAuthUser("erin@example.com");

    await asRole("authenticated", daveId, async () => {
      await db.query(
        `insert into public.reports (type, title, description, created_by)
         values ('bug', 'Un bug', 'Description du bug', $1);`,
        [daveId],
      );
    });

    const { rows: ownReport } = await db.query<{ count: string }>(
      "select count(*)::text as count from public.reports where created_by = $1;",
      [daveId],
    );
    expect(ownReport[0]?.count).toBe("1");

    await expect(
      asRole("authenticated", daveId, async () => {
        await db.query(
          `insert into public.reports (type, title, description, created_by)
           values ('bug', 'Usurpation', 'Description', $1);`,
          [erinId],
        );
      }),
    ).rejects.toThrow();
  });
});

describe("Fonctions RPC — set_app_status et reorder_apps", () => {
  it("fonctionnent avec le service role et sont refusées pour authenticated", async () => {
    const frankId = await createAuthUser("frank@example.com");
    const { rows: appRows } = await db.query<{ id: string }>(
      "insert into public.apps (slug, name) values ($1, $2) returning id;",
      ["app-rpc-rls", "App RPC"],
    );
    const appRow = appRows[0];
    if (!appRow) throw new Error("App de test non créée.");

    await expect(
      asRole("authenticated", frankId, async () => {
        await db.query(
          "select public.set_app_status($1, 'online', null, null);",
          [appRow.id],
        );
      }),
    ).rejects.toThrow();

    await expect(
      asRole("authenticated", frankId, async () => {
        await db.query("select public.reorder_apps(array[$1]::uuid[]);", [
          appRow.id,
        ]);
      }),
    ).rejects.toThrow();

    await asRole("service_role", null, async () => {
      await db.query(
        "select public.set_app_status($1, 'online', null, null);",
        [appRow.id],
      );
    });

    const { rows: checkApp } = await db.query<{ status: string }>(
      "select status from public.apps where id = $1;",
      [appRow.id],
    );
    expect(checkApp[0]?.status).toBe("online");
  });
});
