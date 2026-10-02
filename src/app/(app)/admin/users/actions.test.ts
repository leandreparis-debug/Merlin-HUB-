import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VIEW_COOKIE_NAME } from "@/lib/auth/constants";
import { createRequestState, redirectTarget } from "@/lib/auth/test-helpers";

process.env["DATA_PROVIDER"] = "memory";

const request = createRequestState();
const revalidatePath = vi.hoisted(() => vi.fn());
const revoked = vi.hoisted(() => [] as string[]);
const partialFailure = vi.hoisted(() => ({ enabled: false }));

vi.mock("next/headers", () => ({
  cookies: () => request.nextHeaders.cookies(),
  headers: () => request.nextHeaders.headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => request.nextNavigation.redirect(url),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
// Enregistre les appels à revokeSessions tout en conservant le vrai service.
vi.mock("@/lib/auth/providers/memory/account-admin", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/lib/auth/providers/memory/account-admin")
    >();
  return {
    ...original,
    createMemoryAccountAdminService: (
      deps: Parameters<typeof original.createMemoryAccountAdminService>[0],
    ) => {
      const service = original.createMemoryAccountAdminService(deps);
      return {
        ...service,
        createAccount: (input: Parameters<typeof service.createAccount>[0]) =>
          partialFailure.enabled
            ? Promise.resolve({
                ok: false as const,
                reason: "unexpected" as const,
                maybeCreated: true,
              })
            : service.createAccount(input),
        revokeSessions: async (id: string) => {
          revoked.push(id);
          return service.revokeSessions(id);
        },
      };
    },
  };
});

const actions = await import("@/app/(app)/admin/users/actions");
const { loginAction } = await import("@/lib/auth/actions");
const { getMemoryRepositories } = await import("@/lib/data");
const { getAccountAdminService, getAuthService } =
  await import("@/lib/auth/factory");

const GONE = "/admin/users?notice=gone";
const MISSING_ID = "00000000-0000-4000-8000-0000000000ff";
const repos = () => getMemoryRepositories();

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
const adminProfile = () => repos().profiles.getByEmail("admin@example.test");

let counter = 0;
/** Crée un compte cible via le service (renvoie id, email et mot de passe provisoire). */
async function makeUser(role: "user" | "admin" = "user") {
  counter += 1;
  const email = `cible-${counter}-${Date.now()}@example.test`;
  const result = await getAccountAdminService().createAccount({
    email,
    fullName: `Cible ${counter}`,
    role,
  });
  if (!result.ok) throw new Error("création attendue");
  return { id: result.userId, email, password: result.provisionalPassword };
}

// Le journal et le store sont partagés par tout le fichier.
const previousLogIds = new Set<string>();
async function userLogs(action?: string) {
  const entries = await repos().activityLog.list({ limit: 1000 });
  return entries.filter(
    (entry) =>
      !previousLogIds.has(entry.id) &&
      (action ? entry.action === action : entry.action.startsWith("user.")),
  );
}

const createForm = (overrides: Record<string, string> = {}) =>
  form({
    email: `nouveau-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    fullName: "Nouvelle Personne",
    role: "user",
    ...overrides,
  });

let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];

beforeEach(async () => {
  request.cookies.clear();
  request.requestHeaders.clear();
  request.requestHeaders.set("x-merlin-path", "/admin/users");
  revalidatePath.mockClear();
  revoked.length = 0;
  partialFailure.enabled = false;
  delete process.env["ALLOWED_EMAIL_DOMAINS"];
  previousLogIds.clear();
  for (const entry of await repos().activityLog.list({ limit: 1000 })) {
    previousLogIds.add(entry.id);
  }
  consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map(
    (method) => vi.spyOn(console, method).mockImplementation(() => undefined),
  );
});

afterEach(() => {
  for (const spy of consoleSpies) spy.mockRestore();
  delete process.env["ALLOWED_EMAIL_DOMAINS"];
});

function consoleOutput(): string {
  return JSON.stringify(consoleSpies.flatMap((spy) => spy.mock.calls));
}

describe("autorisation : chaque action exige requireAdmin()", () => {
  const invocations: Record<string, (id: string) => Promise<unknown>> = {
    createUserAction: () => actions.createUserAction(null, createForm()),
    updateUserAction: (id) =>
      actions.updateUserAction(null, form({ id, fullName: "Piraté" })),
    changeUserRoleAction: (id) =>
      actions.changeUserRoleAction(null, form({ id, role: "admin" })),
    setUserActiveAction: (id) =>
      actions.setUserActiveAction(null, form({ id, active: "false" })),
    resetUserPasswordAction: (id) =>
      actions.resetUserPasswordAction(null, form({ id })),
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
        const target = await makeUser();
        await context.prepare();
        // Après la connexion (qui met à jour lastLoginAt) : seul l'effet de l'action compte.
        const before = JSON.stringify(
          await repos().profiles.list({ includeInactive: true }),
        );
        const logsBefore = (await userLogs()).length;

        const url = await redirectTarget(() => invoke(target.id));

        expect(url).not.toBeNull();
        expect(url).toMatch(context.expected);
        expect(
          JSON.stringify(
            await repos().profiles.list({ includeInactive: true }),
          ),
        ).toBe(before);
        expect((await userLogs()).length).toBe(logsBefore);
        expect(revoked).toEqual([]);
      });
    }
  }
});

describe("createUserAction", () => {
  it("crée le compte, renvoie le mot de passe provisoire seulement dans le résultat et journalise sans secret", async () => {
    await signInAdmin();
    const email = `NOUVEAU-${Date.now()}@Example.test`;

    const result = await actions.createUserAction(
      null,
      createForm({ email, role: "admin" }),
    );

    expect(result?.ok).toBe(true);
    if (!result?.ok || !result.provisional) throw new Error("succès attendu");
    const { password, userId } = result.provisional;
    expect(password).toHaveLength(20);
    expect(result.provisional.email).toBe(email.toLowerCase());

    const created = await repos().profiles.getById(userId);
    expect(created).toMatchObject({
      role: "admin",
      mustChangePassword: true,
      isActive: true,
    });

    const admin = await adminProfile();
    const [entry] = await userLogs("user.created");
    expect(entry).toMatchObject({
      actorId: admin.id,
      actorEmail: "admin@example.test",
      entityType: "user",
      entityId: userId,
      metadata: { email: email.toLowerCase(), role: "admin" },
    });
    expect(JSON.stringify(entry)).not.toContain(password);
    expect(consoleOutput()).not.toContain(password);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });

  it("le mot de passe provisoire permet la première connexion avec changement forcé", async () => {
    await signInAdmin();
    const result = await actions.createUserAction(null, createForm());
    if (!result?.ok || !result.provisional) throw new Error("succès attendu");

    const signInResult = await getAuthService().signInWithPassword(
      result.provisional.email,
      result.provisional.password,
    );
    expect(signInResult).toMatchObject({
      ok: true,
      user: { mustChangePassword: true, role: "user" },
    });
  });

  it("refuse un email en doublon sur le champ", async () => {
    await signInAdmin();
    const existing = await makeUser();
    const result = await actions.createUserAction(
      null,
      createForm({ email: existing.email.toUpperCase() }),
    );
    expect(result).toMatchObject({
      ok: false,
      fieldErrors: { email: "Un compte existe déjà avec cet email" },
    });
    expect(await userLogs("user.created")).toHaveLength(0);
  });

  it("valide email, nom et rôle avec des messages par champ", async () => {
    await signInAdmin();
    const result = await actions.createUserAction(
      null,
      form({ email: "pas-un-email", fullName: "x".repeat(81), role: "root" }),
    );
    expect(result?.ok).toBe(false);
    if (result && !result.ok) {
      expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual([
        "email",
        "fullName",
        "role",
      ]);
    }
  });

  it("applique ALLOWED_EMAIL_DOMAINS quand elle est définie, sinon aucune restriction", async () => {
    await signInAdmin();
    process.env["ALLOWED_EMAIL_DOMAINS"] =
      "carrefour.com, @carrefourproperty.fr";

    const refused = await actions.createUserAction(
      null,
      createForm({ email: "intrus@example.test" }),
    );
    expect(refused).toMatchObject({
      ok: false,
      fieldErrors: { email: expect.stringContaining("carrefour.com") },
    });

    const accepted = await actions.createUserAction(
      null,
      createForm({ email: `ok-${Date.now()}@carrefourproperty.fr` }),
    );
    expect(accepted?.ok).toBe(true);

    delete process.env["ALLOWED_EMAIL_DOMAINS"];
    const free = await actions.createUserAction(null, createForm());
    expect(free?.ok).toBe(true);
  });

  it("signale une configuration ALLOWED_EMAIL_DOMAINS invalide sans créer de compte", async () => {
    await signInAdmin();
    process.env["ALLOWED_EMAIL_DOMAINS"] = "pas un domaine!";
    const result = await actions.createUserAction(null, createForm());
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining("domaines autorisés"),
    });
    expect(await userLogs("user.created")).toHaveLength(0);
  });

  it("affiche un message de vérification quand l'échec partiel peut avoir laissé un compte", async () => {
    await signInAdmin();
    partialFailure.enabled = true;
    try {
      const result = await actions.createUserAction(null, createForm());
      expect(result).toEqual({
        ok: false,
        message:
          "Le compte a peut-être été créé : vérifiez la liste des utilisateurs.",
      });
    } finally {
      partialFailure.enabled = false;
    }
    expect(await userLogs("user.created")).toHaveLength(0);
  });
});

describe("updateUserAction", () => {
  it("modifie le nom, journalise le nom du champ seulement", async () => {
    await signInAdmin();
    const target = await makeUser();
    const result = await actions.updateUserAction(
      null,
      form({ id: target.id, fullName: "Nouveau Nom" }),
    );
    expect(result).toMatchObject({ ok: true });
    expect((await repos().profiles.getById(target.id)).fullName).toBe(
      "Nouveau Nom",
    );
    const [entry] = await userLogs("user.updated");
    expect(entry?.metadata).toEqual({ fields: ["fullName"] });
  });

  it("ne fait rien sans modification, refuse un nom trop long, ne touche jamais à l'email", async () => {
    await signInAdmin();
    const target = await makeUser();
    const profile = await repos().profiles.getById(target.id);

    expect(
      await actions.updateUserAction(
        null,
        form({ id: target.id, fullName: profile.fullName ?? "" }),
      ),
    ).toMatchObject({
      ok: true,
      message: "Aucune modification à enregistrer.",
    });
    expect(
      await actions.updateUserAction(
        null,
        form({ id: target.id, fullName: "x".repeat(81) }),
      ),
    ).toMatchObject({
      ok: false,
      fieldErrors: { fullName: expect.any(String) },
    });

    await actions.updateUserAction(
      null,
      form({ id: target.id, fullName: "Autre", email: "pirate@example.test" }),
    );
    expect((await repos().profiles.getById(target.id)).email).toBe(
      target.email,
    );
  });

  it("redirige vers la liste si l'utilisateur n'existe plus", async () => {
    await signInAdmin();
    expect(
      await redirectTarget(() =>
        actions.updateUserAction(null, form({ id: MISSING_ID, fullName: "X" })),
      ),
    ).toBe(GONE);
  });
});

describe("changeUserRoleAction", () => {
  it("change le rôle et journalise ancien → nouveau", async () => {
    await signInAdmin();
    const target = await makeUser();
    const result = await actions.changeUserRoleAction(
      null,
      form({ id: target.id, role: "admin" }),
    );
    expect(result).toMatchObject({ ok: true });
    expect((await repos().profiles.getById(target.id)).role).toBe("admin");
    const [entry] = await userLogs("user.role_changed");
    expect(entry).toMatchObject({
      entityId: target.id,
      metadata: { from: "user", to: "admin" },
    });
  });

  it("autorise de rétrograder un autre admin quand il en reste un actif", async () => {
    await signInAdmin();
    const other = await makeUser("admin");
    const result = await actions.changeUserRoleAction(
      null,
      form({ id: other.id, role: "user" }),
    );
    expect(result).toMatchObject({ ok: true });
    expect((await repos().profiles.getById(other.id)).role).toBe("user");
  });

  it("refuse l'auto-rétrogradation côté serveur même si le formulaire est forgé", async () => {
    await signInAdmin();
    const admin = await adminProfile();
    const result = await actions.changeUserRoleAction(
      null,
      form({ id: admin.id, role: "user" }),
    );
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringMatching(/propre rôle/),
    });
    expect((await repos().profiles.getById(admin.id)).role).toBe("admin");
    expect(await userLogs("user.role_changed")).toHaveLength(0);
  });

  it("protège le dernier admin actif (décompte relu à jour)", async () => {
    await signInAdmin();
    const other = await makeUser("admin");
    // Course simulée : au moment de l'écriture, un seul admin actif est compté.
    const spy = vi
      .spyOn(repos().profiles, "countActiveAdmins")
      .mockResolvedValue(1);
    const result = await actions.changeUserRoleAction(
      null,
      form({ id: other.id, role: "user" }),
    );
    spy.mockRestore();
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringMatching(/dernier administrateur actif/),
    });
    expect((await repos().profiles.getById(other.id)).role).toBe("admin");
  });

  it("rejette un rôle invalide et redirige si l'utilisateur n'existe plus", async () => {
    await signInAdmin();
    const target = await makeUser();
    expect(
      await actions.changeUserRoleAction(
        null,
        form({ id: target.id, role: "root" }),
      ),
    ).toMatchObject({ ok: false, fieldErrors: { role: expect.any(String) } });
    expect(
      await redirectTarget(() =>
        actions.changeUserRoleAction(
          null,
          form({ id: MISSING_ID, role: "admin" }),
        ),
      ),
    ).toBe(GONE);
  });
});

describe("setUserActiveAction", () => {
  it("désactive (révocation des sessions tentée, journal) puis réactive", async () => {
    await signInAdmin();
    const target = await makeUser();

    const off = await actions.setUserActiveAction(
      null,
      form({ id: target.id, active: "false" }),
    );
    expect(off).toMatchObject({ ok: true });
    expect((await repos().profiles.getById(target.id)).isActive).toBe(false);
    expect(revoked).toEqual([target.id]);
    expect(await userLogs("user.deactivated")).toHaveLength(1);

    const blocked = await getAuthService().signInWithPassword(
      target.email,
      target.password,
    );
    expect(blocked).toEqual({ ok: false, reason: "disabled" });

    const on = await actions.setUserActiveAction(
      null,
      form({ id: target.id, active: "true" }),
    );
    expect(on).toMatchObject({ ok: true });
    expect((await repos().profiles.getById(target.id)).isActive).toBe(true);
    expect(await userLogs("user.reactivated")).toHaveLength(1);
    expect(revoked).toEqual([target.id]);
  });

  it("refuse l'auto-désactivation côté serveur même si le formulaire est forgé", async () => {
    await signInAdmin();
    const admin = await adminProfile();
    const result = await actions.setUserActiveAction(
      null,
      form({ id: admin.id, active: "false" }),
    );
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringMatching(/votre propre compte/),
    });
    expect((await repos().profiles.getById(admin.id)).isActive).toBe(true);
    expect(revoked).toEqual([]);
    expect(await userLogs("user.deactivated")).toHaveLength(0);
  });

  it("protège le dernier admin actif", async () => {
    await signInAdmin();
    const other = await makeUser("admin");
    const spy = vi
      .spyOn(repos().profiles, "countActiveAdmins")
      .mockResolvedValue(1);
    const result = await actions.setUserActiveAction(
      null,
      form({ id: other.id, active: "false" }),
    );
    spy.mockRestore();
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringMatching(/dernier administrateur actif/),
    });
    expect((await repos().profiles.getById(other.id)).isActive).toBe(true);
  });

  it("redirige vers la liste si l'utilisateur n'existe plus", async () => {
    await signInAdmin();
    expect(
      await redirectTarget(() =>
        actions.setUserActiveAction(
          null,
          form({ id: MISSING_ID, active: "false" }),
        ),
      ),
    ).toBe(GONE);
  });
});

describe("resetUserPasswordAction", () => {
  it("réinitialise : nouveau mot de passe seulement dans le résultat, ancien invalidé, journal sans secret", async () => {
    await signInAdmin();
    const target = await makeUser();
    await repos().profiles.update(target.id, { mustChangePassword: false });

    const result = await actions.resetUserPasswordAction(
      null,
      form({ id: target.id }),
    );

    expect(result?.ok).toBe(true);
    if (!result?.ok || !result.provisional) throw new Error("succès attendu");
    const { password } = result.provisional;
    expect(password).toHaveLength(20);
    expect(password).not.toBe(target.password);
    expect(result.provisional).toMatchObject({
      email: target.email,
      userId: target.id,
    });

    expect((await repos().profiles.getById(target.id)).mustChangePassword).toBe(
      true,
    );
    const auth = getAuthService();
    expect(
      (await auth.signInWithPassword(target.email, target.password)).ok,
    ).toBe(false);
    expect((await auth.signInWithPassword(target.email, password)).ok).toBe(
      true,
    );

    const entries = await userLogs();
    expect(entries.map((entry) => entry.action)).toContain(
      "user.password_reset",
    );
    expect(JSON.stringify(entries)).not.toContain(password);
    expect(consoleOutput()).not.toContain(password);
  });

  it("refuse la réinitialisation de son propre mot de passe", async () => {
    await signInAdmin();
    const admin = await adminProfile();
    const result = await actions.resetUserPasswordAction(
      null,
      form({ id: admin.id }),
    );
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Changer mon mot de passe/),
    });
    expect(await userLogs("user.password_reset")).toHaveLength(0);
    // Le mot de passe de l'admin n'a pas changé.
    expect(
      (
        await getAuthService().signInWithPassword(
          "admin@example.test",
          "Admin-Password-123",
        )
      ).ok,
    ).toBe(true);
  });

  it("redirige vers la liste si l'utilisateur a été supprimé entre-temps", async () => {
    await signInAdmin();
    expect(
      await redirectTarget(() =>
        actions.resetUserPasswordAction(null, form({ id: MISSING_ID })),
      ),
    ).toBe(GONE);
  });
});

describe("le mot de passe provisoire ne fuit nulle part", () => {
  it("n'apparaît ni dans le journal d'activité ni dans la console après création et réinitialisation", async () => {
    await signInAdmin();
    const created = await actions.createUserAction(null, createForm());
    if (!created?.ok || !created.provisional) throw new Error("succès attendu");
    const reset = await actions.resetUserPasswordAction(
      null,
      form({ id: created.provisional.userId }),
    );
    if (!reset?.ok || !reset.provisional) throw new Error("succès attendu");

    const secrets = [created.provisional.password, reset.provisional.password];
    const journal = JSON.stringify(
      await repos().activityLog.list({ limit: 1000 }),
    );
    const output = consoleOutput();
    for (const secret of secrets) {
      expect(journal).not.toContain(secret);
      expect(output).not.toContain(secret);
    }
    // Aucun cookie posé n'embarque non plus le mot de passe.
    expect(JSON.stringify([...request.cookies.entries()])).not.toContain(
      secrets[0],
    );
    expect(JSON.stringify([...request.cookies.entries()])).not.toContain(
      secrets[1],
    );
  });
});
