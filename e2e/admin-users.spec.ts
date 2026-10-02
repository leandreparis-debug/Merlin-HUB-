import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, loginAs, openUserMenu } from "./helpers/auth";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

function userRow(page: Page, email: string) {
  return page.getByTestId("user-row").filter({ hasText: email });
}

test.describe("administration des utilisateurs en lecture seule (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    await expect(page.getByTestId("user-row").first()).toBeVisible();
  });

  test("la liste affiche les comptes de dev, « Vous », « Désactivé » et « Première connexion en attente »", async ({
    page,
  }) => {
    for (const account of Object.values(ACCOUNTS)) {
      await expect(userRow(page, account.email)).toHaveCount(1);
    }
    await expect(
      userRow(page, ACCOUNTS.admin.email).getByText("Vous", { exact: true }),
    ).toBeVisible();
    await expect(
      userRow(page, ACCOUNTS.desactive.email).getByText("Désactivé", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      userRow(page, ACCOUNTS.nouveau.email).getByText(
        "Première connexion en attente",
      ),
    ).toBeVisible();
    await expect(
      userRow(page, ACCOUNTS.admin.email).getByText("Admin", { exact: true }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("la recherche (sans accents) et les filtres rapides fonctionnent", async ({
    page,
  }) => {
    await page.getByLabel("Rechercher un utilisateur").fill("DESACTIVE");
    await expect(userRow(page, ACCOUNTS.desactive.email)).toHaveCount(1);
    await expect(userRow(page, ACCOUNTS.user.email)).toHaveCount(0);
    await page.getByLabel("Rechercher un utilisateur").fill("");

    const inactive = page.getByRole("button", { name: "Désactivés" });
    await inactive.click();
    await expect(inactive).toHaveAttribute("aria-pressed", "true");
    await expect(userRow(page, ACCOUNTS.desactive.email)).toHaveCount(1);
    await expect(userRow(page, ACCOUNTS.admin.email)).toHaveCount(0);

    await page.getByRole("button", { name: "Admins" }).click();
    await expect(userRow(page, ACCOUNTS.admin.email)).toHaveCount(1);
    await expect(userRow(page, ACCOUNTS.user.email)).toHaveCount(0);

    await page.getByLabel("Rechercher un utilisateur").fill("zzzzzz");
    await expect(page.getByTestId("users-no-results")).toBeVisible();
    await page
      .getByRole("button", { name: "Réinitialiser les filtres" })
      .click();
    await expect(userRow(page, ACCOUNTS.user.email)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Tous" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("?q= et ?filter= restaurent la vue ; un filtre invalide est ignoré", async ({
    page,
  }) => {
    await page.goto("/admin/users?filter=inactive");
    await expect(
      page.getByRole("button", { name: "Désactivés" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(userRow(page, ACCOUNTS.desactive.email)).toHaveCount(1);

    await page.goto("/admin/users?q=nouveau&filter=n-importe-quoi");
    await expect(page.getByLabel("Rechercher un utilisateur")).toHaveValue(
      "nouveau",
    );
    await expect(page.getByRole("button", { name: "Tous" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(userRow(page, ACCOUNTS.nouveau.email)).toHaveCount(1);
  });

  test("la sous-navigation marque « Utilisateurs » et le tableau de bord affiche les tuiles", async ({
    page,
  }) => {
    const nav = page.getByRole("navigation", { name: "Administration" });
    await expect(
      nav.getByRole("link", { name: "Utilisateurs" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      nav.getByRole("link", { name: "Tableau de bord" }),
    ).not.toHaveAttribute("aria-current", "page");

    await page.goto("/admin");
    await expect(page.getByTestId("user-tiles")).toContainText(
      "Comptes actifs",
    );
    await expect(page.getByTestId("user-tiles")).toContainText("Admins actifs");
    await expect(page.getByTestId("user-tiles")).toContainText(
      "Première connexion en attente",
    );
  });

  test("la fiche et le formulaire de création s'affichent sans défilement horizontal", async ({
    page,
  }) => {
    await userRow(page, ACCOUNTS.user.email)
      .getByRole("link", { name: /Gérer/ })
      .click();
    await expect(page.getByLabel("Email")).toHaveValue(ACCOUNTS.user.email);
    await expect(page.getByLabel("Email")).toHaveAttribute("readonly", "");
    await expect(
      page.getByText("Pour changer d'adresse, créez un nouveau compte."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Activité récente" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.goto("/admin/users/new");
    await expect(
      page.getByRole("heading", { name: "Ajouter un utilisateur" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("un identifiant inconnu ou mal formé affiche « Utilisateur introuvable »", async ({
    page,
  }) => {
    for (const id of ["00000000-0000-4000-8000-0000000000ff", "pas-un-uuid"]) {
      const response = await page.goto(`/admin/users/${id}`);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: "Utilisateur introuvable" }),
      ).toBeVisible();
    }
  });

  test("sur sa propre fiche, rôle, désactivation et réinitialisation sont désactivés avec explication", async ({
    page,
  }) => {
    await userRow(page, ACCOUNTS.admin.email)
      .getByRole("link", { name: /Gérer/ })
      .click();
    await expect(page.locator("#user-role")).toBeDisabled();
    await expect(page.getByTestId("role-rule")).toContainText("propre rôle");
    await expect(
      page.getByRole("button", { name: "Désactiver le compte" }),
    ).toBeDisabled();
    await expect(page.getByTestId("deactivate-rule")).toContainText(
      "propre compte",
    );
    await expect(
      page.getByRole("button", { name: "Réinitialiser le mot de passe" }),
    ).toBeDisabled();
    await expect(page.getByTestId("reset-rule")).toContainText(
      "Changer mon mot de passe",
    );
  });
});

test.describe("administration des utilisateurs : contrôle d'accès", () => {
  /** Chemin de la fiche de `user@example.test`, lu par un admin. */
  async function userFichePath(page: Page): Promise<string> {
    await loginAs(page, "admin");
    await page.goto("/admin/users");
    const href = await userRow(page, ACCOUNTS.user.email)
      .getByRole("link", { name: /Gérer/ })
      .getAttribute("href");
    expect(href).toMatch(/^\/admin\/users\/[0-9a-f-]{36}$/);
    return href ?? "";
  }

  test("non connecté : redirigé vers /login avec next", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL("/login?next=%2Fadmin%2Fusers");
  });

  test("un utilisateur simple est renvoyé vers /", async ({
    page,
    browser,
    baseURL,
  }) => {
    const fiche = await userFichePath(page);
    const context = await browser.newContext({ baseURL });
    const userPage = await context.newPage();
    try {
      await loginAs(userPage, "user");
      for (const path of ["/admin/users", "/admin/users/new", fiche]) {
        await userPage.goto(path);
        await expect(userPage).toHaveURL("/");
      }
    } finally {
      await context.close();
    }
  });

  test("un admin en vue utilisateur est renvoyé vers /", async ({ page }) => {
    const fiche = await userFichePath(page);
    await page.goto("/");
    await openUserMenu(page);
    await page
      .getByRole("menuitem", { name: "Passer en vue utilisateur" })
      .click();
    await expect(page.getByTestId("view-mode-banner")).toBeVisible();
    for (const path of ["/admin/users", "/admin/users/new", fiche]) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
    }
  });

  test("un utilisateur qui forge merlin_view=admin n'obtient aucun accès", async ({
    page,
    browser,
    baseURL,
  }) => {
    const fiche = await userFichePath(page);
    const context = await browser.newContext({ baseURL });
    const userPage = await context.newPage();
    try {
      await loginAs(userPage, "user");
      await context.addCookies([
        { name: "merlin_view", value: "admin", url: baseURL ?? "" },
      ]);
      for (const path of ["/admin/users", "/admin/users/new", fiche]) {
        await userPage.goto(path);
        await expect(userPage).toHaveURL("/");
      }
    } finally {
      await context.close();
    }
  });
});
