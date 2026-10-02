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
}, 60_000);

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

describe("annonces — published_at (trigger) et RLS", () => {
  async function insertAnnouncement(
    title: string,
    published: boolean,
  ): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.announcements (title, body, is_published)
       values ($1, 'Texte', $2) returning id;`,
      [title, published],
    );
    const row = rows[0];
    if (!row) throw new Error("Annonce de test non créée.");
    return row.id;
  }

  async function publishedAt(id: string): Promise<string | null> {
    const { rows } = await db.query<{ published_at: string | null }>(
      "select published_at::text from public.announcements where id = $1;",
      [id],
    );
    return rows[0]?.published_at ?? null;
  }

  async function createAdmin(email: string): Promise<string> {
    const id = await createAuthUser(email);
    await db.query("update public.profiles set role = 'admin' where id = $1;", [
      id,
    ]);
    return id;
  }

  it("published_at est nul pour un brouillon et posé à la création d'une annonce publiée", async () => {
    const draft = await insertAnnouncement("Brouillon trigger", false);
    const published = await insertAnnouncement("Publiée trigger", true);

    expect(await publishedAt(draft)).toBeNull();
    expect(await publishedAt(published)).not.toBeNull();
  });

  it("la date est posée à la première publication puis conservée (dépublier / republier / modifier)", async () => {
    const id = await insertAnnouncement("Cycle trigger", false);

    await db.query(
      "update public.announcements set is_published = true where id = $1;",
      [id],
    );
    const first = await publishedAt(id);
    expect(first).not.toBeNull();

    await db.query("select pg_sleep(0.05);");
    await db.query(
      "update public.announcements set is_published = false where id = $1;",
      [id],
    );
    expect(await publishedAt(id)).toBe(first);

    await db.query("select pg_sleep(0.05);");
    await db.query(
      "update public.announcements set is_published = true, title = 'Modifiée', is_pinned = true where id = $1;",
      [id],
    );
    expect(await publishedAt(id)).toBe(first);
  });

  it("la contrainte interdit une annonce publiée sans date même si le trigger est contourné", async () => {
    const id = await insertAnnouncement("Contrainte", true);
    await db.exec(
      "alter table public.announcements disable trigger set_announcements_published_at;",
    );
    try {
      await expect(
        db.query(
          "update public.announcements set published_at = null where id = $1;",
          [id],
        ),
      ).rejects.toThrow();
    } finally {
      await db.exec(
        "alter table public.announcements enable trigger set_announcements_published_at;",
      );
    }
  });

  it("un utilisateur simple ne voit que les annonces publiées, jamais un brouillon", async () => {
    const aliceId = await createAuthUser("alice-annonces@example.com");
    const draft = await insertAnnouncement("Brouillon RLS secret", false);
    const published = await insertAnnouncement("Publiée RLS", true);

    const visible = await asRole("authenticated", aliceId, async () => {
      const { rows } = await db.query<{ id: string }>(
        "select id from public.announcements where id = any($1::uuid[]);",
        [[draft, published]],
      );
      return rows.map((row) => row.id);
    });

    expect(visible).toEqual([published]);
  });

  it("un utilisateur simple ne peut ni créer, ni modifier, ni supprimer une annonce", async () => {
    const bobId = await createAuthUser("bob-annonces@example.com");
    const target = await insertAnnouncement("Protégée RLS", true);

    await expect(
      asRole("authenticated", bobId, async () => {
        await db.query(
          "insert into public.announcements (title, body) values ('Pirate', 'x');",
        );
      }),
    ).rejects.toThrow();

    await asRole("authenticated", bobId, async () => {
      await db.query(
        "update public.announcements set title = 'Piratée', is_pinned = true where id = $1;",
        [target],
      );
      await db.query("delete from public.announcements where id = $1;", [
        target,
      ]);
    });

    const { rows } = await db.query<{ title: string; is_pinned: boolean }>(
      "select title, is_pinned from public.announcements where id = $1;",
      [target],
    );
    expect(rows[0]).toEqual({ title: "Protégée RLS", is_pinned: false });
  });

  it("un admin voit les brouillons et peut créer, modifier et supprimer", async () => {
    const adminId = await createAdmin("admin-annonces@example.com");
    const draft = await insertAnnouncement("Brouillon admin", false);

    const seen = await asRole("authenticated", adminId, async () => {
      const { rows } = await db.query<{ id: string }>(
        "select id from public.announcements where id = $1;",
        [draft],
      );
      return rows.length;
    });
    expect(seen).toBe(1);

    await asRole("authenticated", adminId, async () => {
      await db.query(
        "insert into public.announcements (title, body, created_by) values ('Créée par admin', 'x', $1);",
        [adminId],
      );
      await db.query(
        "update public.announcements set is_published = true, is_pinned = true where id = $1;",
        [draft],
      );
    });
    const { rows } = await db.query<{
      is_published: boolean;
      is_pinned: boolean;
    }>(
      "select is_published, is_pinned from public.announcements where id = $1;",
      [draft],
    );
    expect(rows[0]).toEqual({ is_published: true, is_pinned: true });
    expect(await publishedAt(draft)).not.toBeNull();

    await asRole("authenticated", adminId, async () => {
      await db.query("delete from public.announcements where id = $1;", [
        draft,
      ]);
    });
    const { rows: gone } = await db.query(
      "select 1 from public.announcements where id = $1;",
      [draft],
    );
    expect(gone).toHaveLength(0);
  });

  it("un compte désactivé ne voit aucune annonce, pas même publiée", async () => {
    const userId = await createAuthUser("inactif-annonces@example.com");
    const published = await insertAnnouncement("Publiée inactif", true);
    await db.query(
      "update public.profiles set is_active = false where id = $1;",
      [userId],
    );

    const visible = await asRole("authenticated", userId, async () => {
      const { rows } = await db.query(
        "select id from public.announcements where id = $1;",
        [published],
      );
      return rows.length;
    });
    expect(visible).toBe(0);
  });

  it("les contraintes de longueur de titre et de texte sont appliquées par la base", async () => {
    await expect(
      db.query(
        "insert into public.announcements (title, body) values ($1, 'x');",
        ["x".repeat(121)],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into public.announcements (title, body) values ('t', $1);",
        ["x".repeat(2001)],
      ),
    ).rejects.toThrow();
  });
});
