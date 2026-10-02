import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, loginAs, openUserMenu } from "./helpers/auth";

const DEMO_APP_ID = "00000000-0000-4000-8000-000000000001";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

test.describe("administration en lecture seule (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("le tableau de bord affiche les tuiles et la section des derniers changements", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Administration", exact: true }),
    ).toBeVisible();
    const tiles = page.getByTestId("dashboard-tiles");
    await expect(tiles).toBeVisible();
    await expect(tiles).toContainText("5 visible(s), 1 masquée(s)");
    await expect(tiles).toContainText("En ligne");
    await expect(tiles).toContainText("Maintenance");
    await expect(
      page.getByRole("heading", { name: "Derniers changements de statut" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Ajouter une application" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("la liste affiche les 6 apps dont la masquée, étiquetée", async ({
    page,
  }) => {
    await page.goto("/admin/apps");
    const rows = page.getByTestId("admin-app-row");
    await expect(rows).toHaveCount(6);
    const hidden = rows.filter({ hasText: "App masquée de test" });
    await expect(hidden.getByText("Masquée", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Monter Outil entrepôts" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Descendre App masquée de test" }),
    ).toBeDisabled();
    await expectNoHorizontalScroll(page);
  });

  test("la sous-navigation marque la page courante", async ({ page }) => {
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Administration" });
    await expect(
      nav.getByRole("link", { name: "Tableau de bord" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: "Applications" }),
    ).not.toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Applications" }).click();
    await expect(page).toHaveURL("/admin/apps");
    await expect(
      nav.getByRole("link", { name: "Applications" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("le formulaire de création et la fiche s'affichent sans défilement horizontal", async ({
    page,
  }) => {
    await page.goto("/admin/apps/new");
    await expect(
      page.getByRole("heading", { name: "Ajouter une application" }),
    ).toBeVisible();
    await expect(page.getByTestId("app-preview")).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto(`/admin/apps/${DEMO_APP_ID}`);
    await expect(page.getByLabel(/Slug/)).toHaveValue("outil-entrepots");
    await expect(page.getByLabel(/Slug/)).toHaveAttribute("readonly", "");
    await expect(
      page.getByRole("heading", { name: "Journal des changements de statut" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("un identifiant inconnu ou mal formé affiche « Application introuvable »", async ({
    page,
  }) => {
    for (const id of ["00000000-0000-4000-8000-0000000000ff", "pas-un-uuid"]) {
      const response = await page.goto(`/admin/apps/${id}`);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: "Application introuvable" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Retour à la liste" }),
      ).toBeVisible();
    }
  });
});

test.describe("administration : contrôle d'accès", () => {
  const PROTECTED = [
    "/admin",
    "/admin/apps",
    "/admin/apps/new",
    `/admin/apps/${DEMO_APP_ID}`,
  ];

  test("non connecté : redirigé vers /login avec next", async ({ page }) => {
    await page.goto("/admin/apps");
    await expect(page).toHaveURL("/login?next=%2Fadmin%2Fapps");
  });

  test("un utilisateur simple est renvoyé vers /", async ({ page }) => {
    await loginAs(page, "user");
    for (const path of PROTECTED) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
    }
  });

  test("un admin en vue utilisateur est renvoyé vers /", async ({ page }) => {
    await loginAs(page, "admin");
    await openUserMenu(page);
    await page
      .getByRole("menuitem", { name: "Passer en vue utilisateur" })
      .click();
    await expect(page.getByTestId("view-mode-banner")).toBeVisible();
    for (const path of PROTECTED) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
    }
  });

  test("un utilisateur qui forge merlin_view=admin n'obtient aucun accès", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAs(page, "user");
    await context.addCookies([
      { name: "merlin_view", value: "admin", url: baseURL ?? "" },
    ]);
    for (const path of PROTECTED) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
    }
    expect(ACCOUNTS.user.email).toBe("user@example.test");
  });
});
