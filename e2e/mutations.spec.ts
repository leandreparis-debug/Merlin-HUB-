import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";

import { ACCOUNTS, loginAs } from "./helpers/auth";

// Ces tests modifient des données : ils tournent dans le projet « mutations »
// (après les autres, en série, desktop) et suppriment tout ce qu'ils créent.
test.describe.configure({ mode: "serial" });

const INITIAL_APPS = [
  "Outil entrepôts",
  "Comptes rendus de visites",
  "Suivi des contrôles réglementaires",
  "Annuaire des sites",
  "Tableau de bord interne",
];

const unique = (prefix: string) =>
  `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let created: { id: string; name: string }[] = [];

async function createApp(
  page: Page,
  options: { name: string; url?: string; hidden?: boolean },
): Promise<string> {
  await page.goto("/admin/apps/new");
  await page.getByLabel("Nom *").fill(options.name);
  if (options.url) {
    await page.getByLabel("URL de l'application").fill(options.url);
  }
  if (options.hidden) await page.getByLabel("Masquée").check();
  await page.getByRole("button", { name: "Créer l'application" }).click();
  await expect(page).toHaveURL(/\/admin\/apps\/[0-9a-f-]{36}\?notice=created/);
  const id = /\/admin\/apps\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
  created.push({ id, name: options.name });
  await expect(page.getByText("L'application a été créée.")).toBeVisible();
  return id;
}

async function deleteViaUi(page: Page, id: string, name: string) {
  await page.goto(`/admin/apps/${id}`);
  if (
    await page
      .getByRole("heading", { name: "Application introuvable" })
      .isVisible()
  ) {
    return;
  }
  await page.getByText("Supprimer cette application").click();
  await page.getByLabel(/Saisissez le nom exact/).fill(name);
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page).toHaveURL(/\/admin\/apps\?notice=deleted/);
}

/** Ouvre une session « utilisateur » indépendante (nouvelle session) sur l'accueil. */
async function userHome(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(ACCOUNTS.user.email);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill(ACCOUNTS.user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("app-card").first()).toBeVisible();
  return { page, close: () => context.close() };
}

function homeCard(page: Page, name: string): Locator {
  return page.getByTestId("app-card").filter({
    has: page.getByRole("heading", { level: 2, name, exact: true }),
  });
}

async function homeTitles(page: Page): Promise<string[]> {
  await page.reload();
  await expect(page.getByTestId("app-card").first()).toBeVisible();
  return page
    .getByTestId("app-card")
    .getByRole("heading", { level: 2 })
    .allTextContents();
}

function adminRow(page: Page, name: string): Locator {
  return page.getByTestId("admin-app-row").filter({ hasText: name });
}

test.beforeEach(async ({ page }) => {
  created = [];
  await loginAs(page, "admin");
});

// Nettoyage garanti, même si le test échoue.
test.afterEach(async ({ page }) => {
  for (const { id, name } of created) {
    try {
      await deleteViaUi(page, id, name);
    } catch (error) {
      console.error(`Nettoyage impossible pour « ${name} » :`, error);
    }
  }
});

test("créer une app avec URL : visible sur l'accueil d'un utilisateur, puis renommée", async ({
  page,
  browser,
  baseURL,
}) => {
  const name = unique("E2E création");
  const id = await createApp(page, { name, url: "https://example.test/e2e" });

  const user = await userHome(browser, baseURL);
  try {
    const card = homeCard(user.page, name);
    await expect(card).toBeVisible();
    await expect(card.getByRole("link", { name: /^Ouvrir/ })).toHaveAttribute(
      "href",
      "https://example.test/e2e",
    );

    const renamed = `${name} renommée`;
    await page.goto(`/admin/apps/${id}`);
    await page.getByLabel("Nom *").fill(renamed);
    await page
      .getByRole("button", { name: "Enregistrer les modifications" })
      .click();
    await expect(
      page.getByText("Les informations ont été enregistrées."),
    ).toBeVisible();
    created[0] = { id, name: renamed };

    await user.page.reload();
    await expect(homeCard(user.page, renamed)).toBeVisible();
    await expect(homeCard(user.page, name)).toHaveCount(0);
  } finally {
    await user.close();
  }
});

test("une app sans URL affiche « Bientôt disponible » sur l'accueil", async ({
  page,
  browser,
  baseURL,
}) => {
  const name = unique("E2E sans url");
  await createApp(page, { name });
  const user = await userHome(browser, baseURL);
  try {
    const card = homeCard(user.page, name);
    await expect(
      card.getByRole("button", { name: "Bientôt disponible" }),
    ).toBeDisabled();
    await expect(card.getByRole("link")).toHaveCount(0);
  } finally {
    await user.close();
  }
});

test("masquer retire l'app de l'accueil (liste admin conservée), afficher la rétablit", async ({
  page,
  browser,
  baseURL,
}) => {
  const name = unique("E2E visibilité");
  await createApp(page, { name, url: "https://example.test/v" });
  const user = await userHome(browser, baseURL);
  try {
    await expect(homeCard(user.page, name)).toBeVisible();

    await page.goto("/admin/apps");
    await page.getByRole("button", { name: `Masquer ${name}` }).click();
    await expect(page.getByTestId("admin-apps-message")).toContainText(
      "masquée de l'accueil",
    );
    await expect(
      adminRow(page, name).getByText("Masquée", { exact: true }),
    ).toBeVisible();

    await user.page.reload();
    await expect(user.page.getByTestId("app-card").first()).toBeVisible();
    await expect(homeCard(user.page, name)).toHaveCount(0);
    // Aucune trace de l'app masquée dans le HTML ni la charge RSC.
    const html = await (await user.page.request.get("/")).text();
    const rsc = await (
      await user.page.request.get("/", { headers: { RSC: "1" } })
    ).text();
    expect(html).not.toContain(name);
    expect(rsc).not.toContain(name);

    await page.getByRole("button", { name: `Afficher ${name}` }).click();
    await expect(page.getByTestId("admin-apps-message")).toContainText(
      "de nouveau visible",
    );
    await user.page.reload();
    await expect(homeCard(user.page, name)).toBeVisible();
  } finally {
    await user.close();
  }
});

test("changer le statut en maintenance avec note : carte d'accueil, journal de la fiche et tableau de bord", async ({
  page,
  browser,
  baseURL,
}) => {
  const name = unique("E2E statut");
  const id = await createApp(page, { name, url: "https://example.test/s" });

  await page.getByLabel("Nouveau statut").selectOption("maintenance");
  await page
    .getByLabel("Note (facultative)")
    .fill("Opération de maintenance e2e");
  await page.getByRole("button", { name: "Mettre à jour le statut" }).click();
  await expect(
    page.getByText("Statut mis à jour : Hors ligne → Maintenance."),
  ).toBeVisible();

  const journal = page.getByTestId("status-events");
  await expect(journal).toContainText("Hors ligne → Maintenance");
  await expect(journal).toContainText("Opération de maintenance e2e");
  await expect(journal).toContainText("Alex Admin");

  // Statut inchangé : indication claire, pas de nouvel événement.
  await page.getByLabel("Nouveau statut").selectOption("maintenance");
  await expect(page.getByTestId("status-unchanged")).toBeVisible();
  await page.getByLabel("Note (facultative)").fill("Message mis à jour seul");
  await page.getByRole("button", { name: "Mettre à jour le statut" }).click();
  await expect(
    page.getByText("Statut inchangé : seul le message a été mis à jour."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByTestId("status-events").getByRole("listitem"),
  ).toHaveCount(1);

  await page.goto("/admin");
  const recent = page.getByTestId("status-events");
  await expect(recent).toContainText(name);
  await expect(recent.getByRole("link", { name })).toHaveAttribute(
    "href",
    `/admin/apps/${id}`,
  );

  const user = await userHome(browser, baseURL);
  try {
    const card = homeCard(user.page, name);
    await expect(card.getByText("Maintenance")).toBeVisible();
    await expect(card.getByText("Message mis à jour seul")).toBeVisible();
  } finally {
    await user.close();
  }
});

test("monter une app modifie l'ordre dans la liste admin et sur l'accueil", async ({
  page,
  browser,
  baseURL,
}) => {
  const first = unique("E2E ordre A");
  const second = unique("E2E ordre B");
  await createApp(page, { name: first, url: "https://example.test/a" });
  await createApp(page, { name: second, url: "https://example.test/b" });

  const user = await userHome(browser, baseURL);
  try {
    let titles = await homeTitles(user.page);
    expect(titles.indexOf(first)).toBeLessThan(titles.indexOf(second));

    await page.goto("/admin/apps");
    await page.getByRole("button", { name: `Monter ${second}` }).click();
    await expect(page.getByTestId("admin-apps-message")).toContainText(
      "montée",
    );

    await expect
      .poll(async () => {
        const names = await page
          .getByTestId("admin-app-row")
          .evaluateAll((rows) => rows.map((row) => row.textContent ?? ""));
        const index = (label: string) =>
          names.findIndex((text) => text.includes(label));
        return index(second) < index(first);
      })
      .toBe(true);

    titles = await homeTitles(user.page);
    expect(titles.indexOf(second)).toBeLessThan(titles.indexOf(first));
    // Les apps de démonstration gardent leur ordre relatif.
    expect(titles.filter((title) => INITIAL_APPS.includes(title))).toEqual(
      INITIAL_APPS,
    );
  } finally {
    await user.close();
  }
});

test("suppression : mauvaise confirmation sans effet, bonne confirmation retire l'app partout", async ({
  page,
  browser,
  baseURL,
}) => {
  const name = unique("E2E suppression");
  const id = await createApp(page, { name, url: "https://example.test/d" });
  const user = await userHome(browser, baseURL);
  try {
    await page.getByText("Supprimer cette application").click();
    const confirm = page.getByLabel(/Saisissez le nom exact/);
    const button = page.getByRole("button", {
      name: "Supprimer définitivement",
    });

    await confirm.fill("mauvais nom");
    await expect(button).toBeDisabled();
    await page.reload();
    await expect(page.getByLabel(/Slug/)).toBeVisible();

    await page.getByText("Supprimer cette application").click();
    await page.getByLabel(/Saisissez le nom exact/).fill(name);
    await expect(button).toBeEnabled();
    await button.click();

    await expect(page).toHaveURL(/\/admin\/apps\?notice=deleted/);
    await expect(page.getByTestId("admin-apps-message")).toContainText(
      "supprimée",
    );
    await expect(adminRow(page, name)).toHaveCount(0);
    created = created.filter((app) => app.id !== id);

    await user.page.reload();
    await expect(user.page.getByTestId("app-card").first()).toBeVisible();
    await expect(homeCard(user.page, name)).toHaveCount(0);

    await page.goto(`/admin/apps/${id}`);
    await expect(
      page.getByRole("heading", { name: "Application introuvable" }),
    ).toBeVisible();
  } finally {
    await user.close();
  }
});

test("l'état initial est rétabli : 5 apps visibles dans l'ordre d'origine, 6 dans l'administration", async ({
  page,
  browser,
  baseURL,
}) => {
  const user = await userHome(browser, baseURL);
  try {
    expect(await homeTitles(user.page)).toEqual(INITIAL_APPS);
  } finally {
    await user.close();
  }
  await page.goto("/admin/apps");
  await expect(page.getByTestId("admin-app-row")).toHaveCount(6);
});
