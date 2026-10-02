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

const actions = await import("@/app/(app)/admin/apps/actions");
const { loginAction } = await import("@/lib/auth/actions");
const { getMemoryRepositories } = await import("@/lib/data");

const GONE = "/admin/apps?notice=gone";
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

async function createApp(name: string, extra: Record<string, unknown> = {}) {
  return repos().apps.create({
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name,
    ...extra,
  });
}

// Le journal du store mémoire est partagé par tout le fichier : on ignore les
// entrées présentes avant chaque test.
const previousLogIds = new Set<string>();

async function appLogs(action?: string) {
  const entries = await repos().activityLog.list({ limit: 1000 });
  return entries.filter(
    (entry) =>
      !previousLogIds.has(entry.id) &&
      (action ? entry.action === action : entry.action.startsWith("app.")),
  );
}

async function orderedNames() {
  const apps = await repos().apps.listAll();
  return apps.sort((a, b) => a.sortOrder - b.sortOrder).map((app) => app.name);
}

const validForm = (overrides: Record<string, string> = {}) =>
  form({
    name: "Nouvelle app",
    slug: "nouvelle-app",
    description: "Une description",
    icon: "warehouse",
    category: "Entrepôts",
    url: "https://example.test/nouvelle",
    version: "1.0.0",
    visibility: "visible",
    status: "offline",
    statusNote: "",
    ...overrides,
  });

beforeEach(async () => {
  request.cookies.clear();
  request.requestHeaders.clear();
  request.requestHeaders.set("x-merlin-path", "/admin/apps");
  revalidatePath.mockClear();
  const all = await repos().apps.listAll();
  for (const app of all) await repos().apps.delete(app.id);
  previousLogIds.clear();
  for (const entry of await repos().activityLog.list({ limit: 1000 })) {
    previousLogIds.add(entry.id);
  }
});

describe("autorisation : chaque action exige requireAdmin()", () => {
  const invocations: Record<string, (id: string) => Promise<unknown>> = {
    createAppAction: () => actions.createAppAction(null, validForm()),
    updateAppAction: (id) =>
      actions.updateAppAction(
        null,
        validForm({ id, name: "Piraté", slug: "" }),
      ),
    setAppVisibilityAction: (id) => actions.setAppVisibilityAction(id, true),
    moveAppAction: (id) => actions.moveAppAction(id, "down"),
    setAppStatusAction: (id) =>
      actions.setAppStatusAction(
        null,
        form({ id, status: "online", statusNote: "piraté" }),
      ),
    deleteAppAction: (id) =>
      actions.deleteAppAction(null, form({ id, confirmName: "Cible" })),
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
        const target = await createApp("Cible");
        const before = JSON.stringify(await repos().apps.listAll());
        await context.prepare();
        const logsBefore = (await appLogs()).length;

        const url = await redirectTarget(() => invoke(target.id));

        expect(url).not.toBeNull();
        expect(url).toMatch(context.expected);
        expect(JSON.stringify(await repos().apps.listAll())).toBe(before);
        expect(await repos().apps.listStatusEvents(target.id)).toEqual([]);
        expect((await appLogs()).length).toBe(logsBefore);
      });
    }
  }
});

describe("createAppAction", () => {
  it("crée l'application (sortOrder = max + 1), journalise et redirige vers la fiche", async () => {
    await signInAdmin();
    await createApp("Existante");

    const url = await redirectTarget(() =>
      actions.createAppAction(null, validForm()),
    );

    const created = await repos().apps.getBySlug("nouvelle-app");
    expect(url).toBe(`/admin/apps/${created.id}?notice=created`);
    expect(created).toMatchObject({
      name: "Nouvelle app",
      icon: "warehouse",
      sortOrder: 1,
      isHidden: false,
      status: "offline",
    });
    const admin = await repos().profiles.getByEmail("admin@example.test");
    const [entry] = await appLogs("app.created");
    expect(entry).toMatchObject({
      actorId: admin.id,
      actorEmail: "admin@example.test",
      entityType: "app",
      entityId: created.id,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("applique un statut initial avec note : événement attribué à l'admin de la session", async () => {
    await signInAdmin();
    await redirectTarget(() =>
      actions.createAppAction(
        null,
        validForm({ status: "maintenance", statusNote: "Retour à 18 h" }),
      ),
    );
    const created = await repos().apps.getBySlug("nouvelle-app");
    const admin = await repos().profiles.getByEmail("admin@example.test");
    expect(created).toMatchObject({
      status: "maintenance",
      statusMessage: "Retour à 18 h",
    });
    const [event] = await repos().apps.listStatusEvents(created.id);
    expect(event).toMatchObject({
      previousStatus: "offline",
      newStatus: "maintenance",
      changedBy: admin.id,
    });
    expect(await appLogs("app.status_changed")).toHaveLength(1);
  });

  it("refuse un slug en doublon sur le champ concerné", async () => {
    await signInAdmin();
    await createApp("Nouvelle app");
    const result = await actions.createAppAction(null, validForm());
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { slug: expect.stringContaining("déjà utilisé") },
    });
    expect(await appLogs("app.created")).toHaveLength(0);
  });

  it("refuse une URL javascript:, un nom vide et une icône inconnue, avec messages par champ", async () => {
    await signInAdmin();
    const result = await actions.createAppAction(
      null,
      validForm({
        url: "javascript:alert(1)",
        name: "",
        slug: "",
        icon: "n-existe-pas",
      }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(result.fieldErrors?.["url"]).toMatch(/http/);
      expect(result.fieldErrors?.["name"]).toBeDefined();
      expect(result.fieldErrors?.["slug"]).toBeDefined();
      expect(result.fieldErrors?.["icon"]).toBeDefined();
    }
    expect(await repos().apps.listAll()).toHaveLength(0);
  });
});

describe("updateAppAction", () => {
  it("n'envoie et ne journalise que les champs modifiés (noms uniquement)", async () => {
    await signInAdmin();
    const app = await createApp("Outil", {
      description: "Avant",
      category: "Entrepôts",
    });
    const spy = vi.spyOn(repos().apps, "update");

    const result = await actions.updateAppAction(
      null,
      form({
        id: app.id,
        name: "Outil",
        description: "Après",
        icon: "app-window",
        category: "Entrepôts",
        visibility: "visible",
        slug: "tentative-de-changement",
      }),
    );

    expect(result).toEqual({
      ok: true,
      message: "Les informations ont été enregistrées.",
    });
    expect(spy).toHaveBeenCalledWith(app.id, { description: "Après" });
    const updated = await repos().apps.getById(app.id);
    expect(updated.description).toBe("Après");
    expect(updated.slug).toBe(app.slug);
    const [entry] = await appLogs("app.updated");
    expect(entry?.metadata).toEqual({ fields: ["description"] });
    expect(JSON.stringify(entry)).not.toContain("Après");
    spy.mockRestore();
  });

  it("journalise app.hidden / app.shown quand la visibilité change via le formulaire", async () => {
    await signInAdmin();
    const app = await createApp("Outil");
    const base = {
      id: app.id,
      name: "Outil",
      icon: "app-window",
      category: "Général",
    };
    await actions.updateAppAction(
      null,
      form({ ...base, visibility: "hidden" }),
    );
    expect((await repos().apps.getById(app.id)).isHidden).toBe(true);
    expect(await appLogs("app.hidden")).toHaveLength(1);
    expect(await appLogs("app.updated")).toHaveLength(0);
  });

  it("ne fait rien sans modification", async () => {
    await signInAdmin();
    const app = await createApp("Outil");
    const result = await actions.updateAppAction(
      null,
      form({
        id: app.id,
        name: "Outil",
        icon: "app-window",
        category: "Général",
        visibility: "visible",
      }),
    );
    expect(result).toEqual({
      ok: true,
      message: "Aucune modification à enregistrer.",
    });
    expect(await appLogs()).toHaveLength(0);
  });

  it("refuse une entrée invalide avec une erreur par champ", async () => {
    await signInAdmin();
    const app = await createApp("Outil");
    const result = await actions.updateAppAction(
      null,
      form({
        id: app.id,
        name: "Outil",
        icon: "app-window",
        category: "",
        url: "ftp://example.test",
        ownerEmail: "pas-un-email",
        visibility: "visible",
      }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual([
        "category",
        "ownerEmail",
        "url",
      ]);
    }
  });

  it("redirige vers la liste si l'application a été supprimée entre-temps", async () => {
    await signInAdmin();
    const app = await createApp("Outil");
    await repos().apps.delete(app.id);
    const url = await redirectTarget(() =>
      actions.updateAppAction(
        null,
        form({
          id: app.id,
          name: "Autre nom",
          icon: "app-window",
          category: "Général",
          visibility: "visible",
        }),
      ),
    );
    expect(url).toBe(GONE);
  });
});

describe("setAppVisibilityAction", () => {
  it("masque puis affiche, avec journal app.hidden / app.shown", async () => {
    await signInAdmin();
    const app = await createApp("Outil");

    const hidden = await actions.setAppVisibilityAction(app.id, true);
    expect(hidden.ok).toBe(true);
    expect((await repos().apps.getById(app.id)).isHidden).toBe(true);
    expect(await appLogs("app.hidden")).toHaveLength(1);
    expect((await repos().apps.listVisible()).map((a) => a.id)).not.toContain(
      app.id,
    );

    await actions.setAppVisibilityAction(app.id, false);
    expect((await repos().apps.getById(app.id)).isHidden).toBe(false);
    expect(await appLogs("app.shown")).toHaveLength(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("ne journalise rien si la visibilité est déjà celle demandée", async () => {
    await signInAdmin();
    const app = await createApp("Outil");
    await actions.setAppVisibilityAction(app.id, false);
    expect(await appLogs()).toHaveLength(0);
  });

  it("gère une app inexistante ou un id mal formé", async () => {
    await signInAdmin();
    expect(
      await redirectTarget(() =>
        actions.setAppVisibilityAction(MISSING_ID, true),
      ),
    ).toBe(GONE);
    expect(
      await redirectTarget(() =>
        actions.setAppVisibilityAction("pas-un-uuid", true),
      ),
    ).toBe(GONE);
  });
});

describe("moveAppAction", () => {
  async function seed() {
    const a = await createApp("Alpha");
    const b = await createApp("Bravo");
    const c = await createApp("Charlie");
    return { a, b, c };
  }

  it("échange avec le voisin et appelle reorder avec l'ordre complet relu côté serveur", async () => {
    await signInAdmin();
    const { a, b, c } = await seed();
    const spy = vi.spyOn(repos().apps, "reorder");

    const result = await actions.moveAppAction(b.id, "up");

    expect(result.ok).toBe(true);
    expect(spy).toHaveBeenCalledWith([b.id, a.id, c.id]);
    expect(await orderedNames()).toEqual(["Bravo", "Alpha", "Charlie"]);
    const [entry] = await appLogs("app.moved");
    expect(entry).toMatchObject({
      entityId: b.id,
      metadata: { direction: "up" },
    });
    spy.mockRestore();
  });

  it("descend une app du milieu", async () => {
    await signInAdmin();
    const { b } = await seed();
    await actions.moveAppAction(b.id, "down");
    expect(await orderedNames()).toEqual(["Alpha", "Charlie", "Bravo"]);
  });

  it("n'a aucun effet pour la première vers le haut et la dernière vers le bas", async () => {
    await signInAdmin();
    const { a, c } = await seed();
    const spy = vi.spyOn(repos().apps, "reorder");

    expect((await actions.moveAppAction(a.id, "up")).message).toMatch(
      /première/,
    );
    expect((await actions.moveAppAction(c.id, "down")).message).toMatch(
      /dernière/,
    );

    expect(spy).not.toHaveBeenCalled();
    expect(await orderedNames()).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(await appLogs("app.moved")).toHaveLength(0);
    spy.mockRestore();
  });

  it("calcule toujours depuis la liste à jour (deux déplacements successifs)", async () => {
    await signInAdmin();
    const { a, c } = await seed();
    await actions.moveAppAction(c.id, "up");
    expect(await orderedNames()).toEqual(["Alpha", "Charlie", "Bravo"]);
    await actions.moveAppAction(a.id, "down");
    expect(await orderedNames()).toEqual(["Charlie", "Alpha", "Bravo"]);
  });

  it("redirige vers la liste si l'app n'existe plus ou si les arguments sont invalides", async () => {
    await signInAdmin();
    await seed();
    expect(
      await redirectTarget(() => actions.moveAppAction(MISSING_ID, "up")),
    ).toBe(GONE);
    expect(
      await redirectTarget(() => actions.moveAppAction("pas-un-uuid", "up")),
    ).toBe(GONE);
    expect(
      await redirectTarget(() =>
        actions.moveAppAction(MISSING_ID, "sideways" as "up"),
      ),
    ).toBe(GONE);
    expect(await orderedNames()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });
});

describe("setAppStatusAction", () => {
  it("crée un événement (ancien/nouveau, changedBy = admin de la session) et journalise", async () => {
    await signInAdmin();
    const app = await createApp("Outil");

    const result = await actions.setAppStatusAction(
      null,
      form({ id: app.id, status: "maintenance", statusNote: "Mise à jour" }),
    );

    expect(result).toEqual({
      ok: true,
      message: "Statut mis à jour : Hors ligne → Maintenance.",
    });
    const admin = await repos().profiles.getByEmail("admin@example.test");
    const [event] = await repos().apps.listStatusEvents(app.id);
    expect(event).toMatchObject({
      previousStatus: "offline",
      newStatus: "maintenance",
      note: "Mise à jour",
      changedBy: admin.id,
    });
    const [entry] = await appLogs("app.status_changed");
    expect(entry?.metadata).toEqual({ from: "offline", to: "maintenance" });
    expect((await repos().apps.getById(app.id)).statusMessage).toBe(
      "Mise à jour",
    );
  });

  it("n'identifie pas l'acteur d'après le formulaire", async () => {
    await signInAdmin();
    const app = await createApp("Outil");
    await actions.setAppStatusAction(
      null,
      form({
        id: app.id,
        status: "online",
        changedBy: "00000000-0000-4000-8000-0000000000aa",
      }),
    );
    const admin = await repos().profiles.getByEmail("admin@example.test");
    const [event] = await repos().apps.listStatusEvents(app.id);
    expect(event?.changedBy).toBe(admin.id);
  });

  it("statut inchangé : message mis à jour, aucun événement ni journal de statut", async () => {
    await signInAdmin();
    const app = await createApp("Outil");

    const result = await actions.setAppStatusAction(
      null,
      form({ id: app.id, status: "offline", statusNote: "Nouveau message" }),
    );

    expect(result).toEqual({
      ok: true,
      message: "Statut inchangé : seul le message a été mis à jour.",
    });
    expect(await repos().apps.listStatusEvents(app.id)).toEqual([]);
    expect((await repos().apps.getById(app.id)).statusMessage).toBe(
      "Nouveau message",
    );
    expect(await appLogs("app.status_changed")).toHaveLength(0);
  });

  it("refuse une note trop longue ou un statut invalide", async () => {
    await signInAdmin();
    const app = await createApp("Outil");
    const tooLong = await actions.setAppStatusAction(
      null,
      form({ id: app.id, status: "online", statusNote: "x".repeat(301) }),
    );
    expect(tooLong).toMatchObject({
      ok: false,
      fieldErrors: { statusNote: expect.stringContaining("300") },
    });
    const invalid = await actions.setAppStatusAction(
      null,
      form({ id: app.id, status: "explosé" }),
    );
    expect(invalid?.ok).toBe(false);
    expect(await repos().apps.listStatusEvents(app.id)).toEqual([]);
  });

  it("redirige vers la liste si l'application n'existe plus", async () => {
    await signInAdmin();
    expect(
      await redirectTarget(() =>
        actions.setAppStatusAction(
          null,
          form({ id: MISSING_ID, status: "online" }),
        ),
      ),
    ).toBe(GONE);
  });
});

describe("deleteAppAction", () => {
  it("ne supprime rien si le nom saisi est incorrect", async () => {
    await signInAdmin();
    const app = await createApp("Outil important");
    const result = await actions.deleteAppAction(
      null,
      form({ id: app.id, confirmName: "outil important" }),
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: {
        confirmName: expect.stringContaining("ne correspond pas"),
      },
    });
    expect(await repos().apps.getById(app.id)).toBeDefined();
    expect(await appLogs("app.deleted")).toHaveLength(0);
  });

  it("supprime avec le nom exact, journalise et redirige vers la liste", async () => {
    await signInAdmin();
    const app = await createApp("Outil important");
    await repos().apps.setStatus(app.id, "online");

    const url = await redirectTarget(() =>
      actions.deleteAppAction(
        null,
        form({ id: app.id, confirmName: "Outil important" }),
      ),
    );

    expect(url).toBe("/admin/apps?notice=deleted");
    expect(await repos().apps.listAll()).toEqual([]);
    expect(await repos().apps.listStatusEvents(app.id)).toEqual([]);
    const [entry] = await appLogs("app.deleted");
    expect(entry).toMatchObject({ entityId: app.id });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("redirige vers la liste avec un message clair si l'app a déjà été supprimée", async () => {
    await signInAdmin();
    const app = await createApp("Ephemere");
    await repos().apps.delete(app.id);
    expect(
      await redirectTarget(() =>
        actions.deleteAppAction(
          null,
          form({ id: app.id, confirmName: "Ephemere" }),
        ),
      ),
    ).toBe(GONE);
  });
});
