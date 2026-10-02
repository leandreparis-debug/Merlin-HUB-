import { expect, test, type Page } from "@playwright/test";

import { ACCOUNTS, loginAs, openUserMenu, submitLogin } from "./helpers/auth";

const GENERIC_ERROR = "Email ou mot de passe incorrect";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

test.describe("accès non connecté", () => {
  test("/ redirige vers /login avec next", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/login?next=%2F");
  });

  test("/admin sans session redirige vers /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL("/login?next=%2Fadmin");
  });

  test("/api/health, /robots.txt et la 404 restent publics", async ({
    page,
    request,
  }) => {
    expect((await request.get("/api/health")).status()).toBe(200);
    expect((await request.get("/robots.txt")).status()).toBe(200);
    const response = await page.goto("/cette-page-n-existe-pas");
    expect(response?.status()).toBe(404);
    await expect(page).toHaveURL("/cette-page-n-existe-pas");
  });

  test("la page de connexion s'affiche sans défilement horizontal", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Connexion à Merlin" }),
    ).toBeVisible();
    await expect(page.getByText(/Contactez l'administrateur/)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("connexion", () => {
  test("un utilisateur se connecte et arrive sur l'accueil", async ({
    page,
  }) => {
    await loginAs(page, "user");
    await expect(
      page.getByRole("heading", { name: "Vos applications" }),
    ).toBeVisible();
  });

  test("un mauvais mot de passe affiche le message générique", async ({
    page,
  }) => {
    await page.goto("/login");
    await submitLogin(page, ACCOUNTS.user.email, "mauvais-mot-de-passe");
    await expect(page.locator('form [role="alert"]')).toHaveText(GENERIC_ERROR);
    await expect(page).toHaveURL(/\/login/);
  });

  test("un email inconnu affiche le même message", async ({ page }) => {
    await page.goto("/login");
    await submitLogin(page, "inconnu@example.test", "Whatever-Password-1");
    await expect(page.locator('form [role="alert"]')).toHaveText(GENERIC_ERROR);
  });

  test("un compte désactivé affiche un message dédié", async ({ page }) => {
    await page.goto("/login");
    await submitLogin(
      page,
      ACCOUNTS.desactive.email,
      ACCOUNTS.desactive.password,
    );
    await expect(page.locator('form [role="alert"]')).toHaveText(
      "Ce compte est désactivé. Contactez l'administrateur.",
    );
  });

  test("un paramètre next malveillant est ignoré", async ({ page }) => {
    await page.goto("/login?next=//evil.com");
    await submitLogin(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await expect(page).toHaveURL("/");
  });

  test("next valide : retour sur la page demandée", async ({ page }) => {
    await page.goto("/login?next=/change-password");
    await submitLogin(page, ACCOUNTS.user.email, ACCOUNTS.user.password);
    await expect(page).toHaveURL("/change-password");
  });
});

test.describe("menu utilisateur", () => {
  test("un utilisateur simple n'a ni bascule ni espace admin", async ({
    page,
  }) => {
    await loginAs(page, "user");
    await openUserMenu(page);
    await expect(page.getByText("Utilisateur", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Changer mon mot de passe" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Passer en vue utilisateur" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("menuitem", { name: "Espace administration" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("un admin voit la bascule et l'espace administration", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await openUserMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "Espace administration" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Passer en vue utilisateur" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe("déconnexion", () => {
  test("renvoie sur /login, protège / et le bouton Retour ne ré-affiche pas la page", async ({
    page,
  }) => {
    await loginAs(page, "user");
    await openUserMenu(page);
    await page.getByRole("menuitem", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL("/login");

    await page.goto("/");
    await expect(page).toHaveURL("/login?next=%2F");

    await page.goBack();
    await page.goBack().catch(() => undefined);
    await expect(
      page.getByRole("heading", { name: "Vos applications" }),
    ).toHaveCount(0);
  });
});

test.describe("rôles et vue admin/utilisateur", () => {
  test("un utilisateur simple sur /admin est renvoyé vers /", async ({
    page,
  }) => {
    await loginAs(page, "user");
    await page.goto("/admin");
    await expect(page).toHaveURL("/");
  });

  test("un utilisateur qui forge merlin_view=admin n'obtient aucun accès admin", async ({
    page,
    context,
    baseURL,
  }) => {
    await loginAs(page, "user");
    await context.addCookies([
      { name: "merlin_view", value: "admin", url: baseURL ?? "" },
    ]);
    await page.goto("/admin");
    await expect(page).toHaveURL("/");
    await openUserMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "Espace administration" }),
    ).toHaveCount(0);
  });

  test("un admin accède à /admin", async ({ page }) => {
    await loginAs(page, "admin");
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Espace administration" }),
    ).toBeVisible();
  });

  test("bascule en vue utilisateur puis retour en vue admin", async ({
    page,
  }) => {
    await loginAs(page, "admin");
    await page.goto("/admin");
    await openUserMenu(page);
    await page
      .getByRole("menuitem", { name: "Passer en vue utilisateur" })
      .click();

    await expect(page).toHaveURL("/");
    const banner = page.getByTestId("view-mode-banner");
    await expect(banner).toContainText(
      "Vous consultez Merlin comme un utilisateur",
    );

    await page.goto("/admin");
    await expect(page).toHaveURL("/");

    await banner.getByRole("button", { name: "Revenir en vue admin" }).click();
    await expect(page.getByTestId("view-mode-banner")).toHaveCount(0);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Espace administration" }),
    ).toBeVisible();
  });
});

test.describe("changement de mot de passe forcé", () => {
  // Modifie le store mémoire du serveur (partagé entre les projets) : une
  // seule exécution par lancement.
  test("le compte « nouveau » est forcé sur /change-password puis accède au site", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "mutation d'état serveur : exécuté une seule fois",
    );
    await page.goto("/login");
    await submitLogin(page, ACCOUNTS.nouveau.email, ACCOUNTS.nouveau.password);
    await expect(page).toHaveURL("/change-password");
    await expect(
      page.getByText(
        "Pour votre sécurité, choisissez un nouveau mot de passe avant de continuer",
      ),
    ).toBeVisible();

    await page.goto("/");
    await expect(page).toHaveURL("/change-password");

    await openUserMenu(page);
    await expect(
      page.getByRole("menuitem", { name: "Changer mon mot de passe" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.getByLabel("Mot de passe actuel").fill("mauvais");
    await page
      .getByLabel("Nouveau mot de passe", { exact: true })
      .fill("Correct-Horse-Battery-42");
    await page
      .getByLabel("Confirmer le nouveau mot de passe")
      .fill("Correct-Horse-Battery-42");
    await page
      .getByRole("button", { name: "Changer mon mot de passe" })
      .click();
    await expect(page.locator('form [role="alert"]')).toHaveText(
      "Le mot de passe actuel est incorrect.",
    );

    await page
      .getByLabel("Mot de passe actuel")
      .fill(ACCOUNTS.nouveau.password);
    await page
      .getByLabel("Nouveau mot de passe", { exact: true })
      .fill("Correct-Horse-Battery-42");
    await page
      .getByLabel("Confirmer le nouveau mot de passe")
      .fill("Correct-Horse-Battery-42");
    await page
      .getByRole("button", { name: "Changer mon mot de passe" })
      .click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("status")).toContainText(
      "Votre mot de passe a bien été modifié.",
    );
    await expect(
      page.getByRole("heading", { name: "Vos applications" }),
    ).toBeVisible();
  });
});
