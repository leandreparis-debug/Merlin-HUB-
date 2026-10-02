import { beforeEach, describe, expect, it, vi } from "vitest";

import { VIEW_COOKIE_NAME } from "@/lib/auth/constants";
import { createRequestState, redirectTarget } from "@/lib/auth/test-helpers";

process.env["DATA_PROVIDER"] = "memory";

const request = createRequestState();
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: () => request.nextHeaders.cookies(),
  headers: () => request.nextHeaders.headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => request.nextNavigation.redirect(url),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

const actions = await import("@/app/(app)/admin/announcements/actions");
const { loginAction } = await import("@/lib/auth/actions");
const { getMemoryRepositories } = await import("@/lib/data");

const GONE = "/admin/announcements?notice=gone";
const MISSING_ID = "00000000-0000-4000-8000-0000000000ff";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function signIn(email: string, password: string) {
  await redirectTarget(() =>
    loginAction({}, form({ email, password, next: "/" })),
  );
}
const signInAdmin = () => signIn("admin@example.test", "Admin-Password-123");

const repos = () => getMemoryRepositories();

async function createAnnouncement(
  title: string,
  extra: { isPinned?: boolean; isPublished?: boolean } = {},
) {
  return repos().announcements.create({ title, body: "Texte", ...extra });
}

// Le journal du store mémoire est partagé par tout le fichier : on ignore les
// entrées présentes avant chaque test.
const previousLogIds = new Set<string>();

async function announcementLogs(action?: string) {
  const entries = await repos().activityLog.list({ limit: 1000 });
  return entries.filter(
    (entry) =>
      !previousLogIds.has(entry.id) &&
      (action
        ? entry.action === action
        : entry.action.startsWith("announcement.")),
  );
}

const validForm = (overrides: Record<string, string> = {}) =>
  form({ title: "Nouvelle annonce", text: "Un texte.", ...overrides });

beforeEach(async () => {
  request.cookies.clear();
  request.requestHeaders.clear();
  request.requestHeaders.set("x-merlin-path", "/admin/announcements");
  revalidatePath.mockClear();
  for (const item of await repos().announcements.listAll()) {
    await repos().announcements.delete(item.id);
  }
  previousLogIds.clear();
  for (const entry of await repos().activityLog.list({ limit: 1000 })) {
    previousLogIds.add(entry.id);
  }
});

describe("autorisation : chaque action exige requireAdmin()", () => {
  const invocations: Record<string, (id: string) => Promise<unknown>> = {
    createAnnouncementAction: () =>
      actions.createAnnouncementAction(null, validForm()),
    updateAnnouncementAction: (id) =>
      actions.updateAnnouncementAction(
        null,
        validForm({ id, title: "Piraté" }),
      ),
    setAnnouncementPinnedAction: (id) =>
      actions.setAnnouncementPinnedAction(id, true),
    setAnnouncementPublishedAction: (id) =>
      actions.setAnnouncementPublishedAction(id, false),
    deleteAnnouncementAction: (id) =>
      actions.deleteAnnouncementAction(null, form({ id, confirm: "yes" })),
  };

  const contexts: Record<
    string,
    { prepare: () => Promise<void>; expected: RegExp | string }
  > = {
    "non connecté": {
      prepare: async () => undefined,
      expected: /^\/login\?next=/,
    },
    "utilisateur simple": {
      prepare: () => signIn("user@example.test", "User-Password-123"),
      expected: "/",
    },
    "utilisateur simple avec cookie de vue forgé": {
      prepare: async () => {
        await signIn("user@example.test", "User-Password-123");
        request.cookies.set(VIEW_COOKIE_NAME, "admin");
      },
      expected: "/",
    },
    "admin en vue utilisateur": {
      prepare: async () => {
        await signInAdmin();
        request.cookies.set(VIEW_COOKIE_NAME, "user");
      },
      expected: "/",
    },
  };

  for (const [actionName, invoke] of Object.entries(invocations)) {
    for (const [contextName, context] of Object.entries(contexts)) {
      it(`${actionName} refuse : ${contextName}`, async () => {
        const target = await createAnnouncement("Cible");
        const before = JSON.stringify(await repos().announcements.listAll());
        await context.prepare();
        const logsBefore = (await announcementLogs()).length;

        const url = await redirectTarget(() => invoke(target.id));

        expect(url).not.toBeNull();
        expect(url).toMatch(context.expected);
        expect(JSON.stringify(await repos().announcements.listAll())).toBe(
          before,
        );
        expect((await announcementLogs()).length).toBe(logsBefore);
      });
    }
  }
});

describe("createAnnouncementAction", () => {
  it("crée une annonce publiée par défaut, attribuée à l'admin, journalise sans copier le contenu", async () => {
    await signInAdmin();

    const url = await redirectTarget(() =>
      actions.createAnnouncementAction(
        null,
        validForm({ isPublished: "on", isPinned: "on" }),
      ),
    );

    const [created] = await repos().announcements.listAll();
    expect(url).toBe(`/admin/announcements/${created?.id}?notice=created`);
    expect(created).toMatchObject({
      title: "Nouvelle annonce",
      isPublished: true,
      isPinned: true,
    });
    const admin = await repos().profiles.getByEmail("admin@example.test");
    expect(created?.createdBy).toBe(admin.id);

    const [entry] = await announcementLogs("announcement.created");
    expect(entry).toMatchObject({
      actorId: admin.id,
      actorEmail: "admin@example.test",
      entityType: "announcement",
      entityId: created?.id,
      metadata: { published: true, pinned: true },
    });
    expect(JSON.stringify(entry)).not.toContain("Nouvelle annonce");
    expect(JSON.stringify(entry)).not.toContain("Un texte");
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/announcements");
  });

  it("sans case « Publier » : brouillon, jamais publié", async () => {
    await signInAdmin();
    await redirectTarget(() =>
      actions.createAnnouncementAction(null, validForm()),
    );
    const [created] = await repos().announcements.listAll();
    expect(created).toMatchObject({ isPublished: false, publishedAt: null });
    expect(await repos().announcements.listPublished()).toEqual([]);
  });

  it("retourne des erreurs par champ sans rien créer", async () => {
    await signInAdmin();
    const result = await actions.createAnnouncementAction(
      null,
      form({ title: "  ", text: "x".repeat(2001) }),
    );

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        title: "Le titre est requis",
        text: "Le texte ne doit pas dépasser 2000 caractères",
      },
    });
    expect(await repos().announcements.listAll()).toEqual([]);
    expect(await announcementLogs()).toEqual([]);
  });

  it("refuse un texte fait d'espaces", async () => {
    await signInAdmin();
    const result = await actions.createAnnouncementAction(
      null,
      form({ title: "Titre", text: " \n " }),
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { text: "Le texte est requis" },
    });
  });

  it("stocke le HTML tel quel (texte brut)", async () => {
    await signInAdmin();
    await redirectTarget(() =>
      actions.createAnnouncementAction(
        null,
        validForm({ text: "<img src=x onerror=alert(1)>" }),
      ),
    );
    const [created] = await repos().announcements.listAll();
    expect(created?.body).toBe("<img src=x onerror=alert(1)>");
  });
});

describe("updateAnnouncementAction", () => {
  it("modifie titre et texte, journalise les NOMS de champs uniquement", async () => {
    await signInAdmin();
    const target = await createAnnouncement("Avant");

    const result = await actions.updateAnnouncementAction(
      null,
      form({ id: target.id, title: "Après", text: "Nouveau texte" }),
    );

    expect(result).toEqual({
      ok: true,
      message: "L'annonce a été enregistrée.",
    });
    expect(await repos().announcements.getById(target.id)).toMatchObject({
      title: "Après",
      body: "Nouveau texte",
      publishedAt: target.publishedAt,
    });
    const [entry] = await announcementLogs("announcement.updated");
    expect(entry?.metadata).toEqual({ fields: ["title", "text"] });
    expect(JSON.stringify(entry)).not.toContain("Après");
    expect(JSON.stringify(entry)).not.toContain("Nouveau texte");
  });

  it("n'écrit ni ne journalise rien sans modification", async () => {
    await signInAdmin();
    const target = await createAnnouncement("Titre");
    const result = await actions.updateAnnouncementAction(
      null,
      form({ id: target.id, title: "Titre", text: "Texte" }),
    );
    expect(result).toMatchObject({ ok: true });
    expect(await announcementLogs()).toEqual([]);
  });

  it("erreurs par champ pour une saisie invalide", async () => {
    await signInAdmin();
    const target = await createAnnouncement("Titre");
    const result = await actions.updateAnnouncementAction(
      null,
      form({ id: target.id, title: "", text: "ok" }),
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { title: "Le titre est requis" },
    });
  });

  it("annonce supprimée entre-temps : redirige vers la liste avec le message", async () => {
    await signInAdmin();
    expect(
      await redirectTarget(() =>
        actions.updateAnnouncementAction(
          null,
          form({ id: MISSING_ID, title: "x", text: "y" }),
        ),
      ),
    ).toBe(GONE);
  });
});

describe("setAnnouncementPinnedAction", () => {
  it("épingle puis désépingle avec journal, de façon idempotente", async () => {
    await signInAdmin();
    const target = await createAnnouncement("Cible");

    await actions.setAnnouncementPinnedAction(target.id, true);
    await actions.setAnnouncementPinnedAction(target.id, true);
    expect((await repos().announcements.getById(target.id)).isPinned).toBe(
      true,
    );
    expect(await announcementLogs("announcement.pinned")).toHaveLength(1);

    await actions.setAnnouncementPinnedAction(target.id, false);
    await actions.setAnnouncementPinnedAction(target.id, false);
    expect((await repos().announcements.getById(target.id)).isPinned).toBe(
      false,
    );
    expect(await announcementLogs("announcement.unpinned")).toHaveLength(1);
    expect(await announcementLogs("announcement.pinned")).toHaveLength(1);
  });

  it("avertit sans bloquer au-delà de 3 annonces épinglées", async () => {
    await signInAdmin();
    for (let i = 0; i < 3; i += 1) {
      await createAnnouncement(`P${i}`, { isPinned: true });
    }
    const fourth = await createAnnouncement("Quatrième");

    const result = await actions.setAnnouncementPinnedAction(fourth.id, true);

    expect(result.ok).toBe(true);
    expect(result.message).toContain("4 annonces sont épinglées");
    expect((await repos().announcements.getById(fourth.id)).isPinned).toBe(
      true,
    );
  });

  it("annonce inconnue ou id mal formé : redirige vers la liste", async () => {
    await signInAdmin();
    expect(
      await redirectTarget(() =>
        actions.setAnnouncementPinnedAction(MISSING_ID, true),
      ),
    ).toBe(GONE);
    expect(
      await redirectTarget(() =>
        actions.setAnnouncementPinnedAction("pas-un-uuid", true),
      ),
    ).toBe(GONE);
  });
});

describe("setAnnouncementPublishedAction", () => {
  it("dépublie puis republie en conservant la date de première publication", async () => {
    await signInAdmin();
    const target = await createAnnouncement("Cible");

    await actions.setAnnouncementPublishedAction(target.id, false);
    await actions.setAnnouncementPublishedAction(target.id, false);
    expect(await repos().announcements.listPublished()).toEqual([]);
    expect(await announcementLogs("announcement.unpublished")).toHaveLength(1);

    await actions.setAnnouncementPublishedAction(target.id, true);
    await actions.setAnnouncementPublishedAction(target.id, true);
    const after = await repos().announcements.getById(target.id);
    expect(after.isPublished).toBe(true);
    expect(after.publishedAt).toBe(target.publishedAt);
    expect(await announcementLogs("announcement.published")).toHaveLength(1);
  });

  it("publie un brouillon : la date de première publication est posée", async () => {
    await signInAdmin();
    const draft = await createAnnouncement("Brouillon", { isPublished: false });
    expect(draft.publishedAt).toBeNull();

    await actions.setAnnouncementPublishedAction(draft.id, true);

    const after = await repos().announcements.getById(draft.id);
    expect(after.publishedAt).not.toBeNull();
    expect(
      (await repos().announcements.listPublished()).map((a) => a.id),
    ).toEqual([draft.id]);
  });

  it("annonce inconnue : redirige vers la liste", async () => {
    await signInAdmin();
    expect(
      await redirectTarget(() =>
        actions.setAnnouncementPublishedAction(MISSING_ID, true),
      ),
    ).toBe(GONE);
  });
});

describe("deleteAnnouncementAction", () => {
  it("exige la confirmation, revérifiée côté serveur", async () => {
    await signInAdmin();
    const target = await createAnnouncement("Cible");

    const result = await actions.deleteAnnouncementAction(
      null,
      form({ id: target.id }),
    );

    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { confirm: expect.stringContaining("Cochez") },
    });
    expect(await repos().announcements.getById(target.id)).toBeDefined();
    expect(await announcementLogs()).toEqual([]);
  });

  it("supprime, journalise sans le titre et redirige avec l'avis", async () => {
    await signInAdmin();
    const target = await createAnnouncement("Titre secret");

    const url = await redirectTarget(() =>
      actions.deleteAnnouncementAction(
        null,
        form({ id: target.id, confirm: "yes" }),
      ),
    );

    expect(url).toBe("/admin/announcements?notice=deleted");
    expect(await repos().announcements.listAll()).toEqual([]);
    const [entry] = await announcementLogs("announcement.deleted");
    expect(entry).toMatchObject({
      entityType: "announcement",
      entityId: target.id,
      metadata: {},
    });
    expect(JSON.stringify(entry)).not.toContain("Titre secret");
  });

  it("annonce déjà supprimée : redirige avec « n'existe plus »", async () => {
    await signInAdmin();
    expect(
      await redirectTarget(() =>
        actions.deleteAnnouncementAction(
          null,
          form({ id: MISSING_ID, confirm: "yes" }),
        ),
      ),
    ).toBe(GONE);
  });
});
