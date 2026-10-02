import { expect, test, type Page } from "@playwright/test";

import { loginAs, openUserMenu } from "./helpers/auth";

// Annonces de démonstration du store mémoire (src/lib/data/providers/memory/demo-announcements.ts).
const PINNED = "Bienvenue sur Merlin";
const RECENT = "Nouvelle version du suivi des baux";
const OLDER = "Maintenance planifiée de l'outil entrepôts";
const DRAFT = "Brouillon de test";
const DRAFT_TEXT = "Texte confidentiel de brouillon";

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

async function cardTitles(page: Page, scope = page.locator("body")) {
  const cards = scope.getByTestId("announcement-card");
  await expect(cards.first()).toBeVisible();
  return cards.getByRole("heading", { level: 3 }).allTextContents();
}

test.describe("annonces côté utilisateur (lecture seule)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "user");
  });

  test("l'accueil affiche la zone « Annonces » : épinglée d'abord, jamais le brouillon", async ({
    page,
  }) => {
    const zone = page.getByTestId("announcements-zone");
    await expect(
      zone.getByRole("heading", { level: 2, name: "Annonces" }),
    ).toBeVisible();

    expect(await cardTitles(page, zone)).toEqual([PINNED, RECENT, OLDER]);
    await expect(
      zone.getByTestId("announcement-card").first().getByText("Épinglée"),
    ).toBeVisible();
    await expect(zone.getByText(DRAFT)).toHaveCount(0);
    await expect(page.getByText("Toutes les annonces")).toHaveCount(0);
    await expectNoHorizontalScroll(page);
  });

  test("la zone est au-dessus de la recherche du catalogue", async ({
    page,
  }) => {
    const zoneBox = await page.getByTestId("announcements-zone").boundingBox();
    const searchBox = await page
      .getByRole("searchbox")
      .or(page.getByRole("textbox", { name: /Rechercher/ }))
      .first()
      .boundingBox();
    expect(zoneBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect((zoneBox?.y ?? 0) + (zoneBox?.height ?? 0)).toBeLessThanOrEqual(
      searchBox?.y ?? 0,
    );
  });

  test("le catalogue reste intact (5 cartes) à côté des annonces", async ({
    page,
  }) => {
    await expect(page.getByTestId("app-card")).toHaveCount(5);
    await expect(page.getByTestId("announcement-card")).toHaveCount(3);
  });

  test("le texte du brouillon est absent du HTML et du flux RSC de / et /announcements", async ({
    page,
  }) => {
    for (const path of ["/", "/announcements"]) {
      const variants: Record<string, string>[] = [{}, { RSC: "1" }];
      for (const headers of variants) {
        const response = await page.request.get(path, { headers });
        expect(response.status()).toBe(200);
        const body = await response.text();
        expect(body, `${path} ${JSON.stringify(headers)}`).not.toContain(
          DRAFT_TEXT,
        );
        expect(body).not.toContain(DRAFT);
        expect(body).toContain(PINNED);
      }
    }
  });

  test("/announcements : titre, ordre, dates absolues et relatives, lien de retour", async ({
    page,
  }) => {
    await page.goto("/announcements");
    await expect(
      page.getByRole("heading", { level: 1, name: "Annonces" }),
    ).toBeVisible();
    expect(await cardTitles(page)).toEqual([PINNED, RECENT, OLDER]);

    const first = page.getByTestId("announcement-card").first();
    await expect(first.getByText(/publiée /)).toBeVisible();
    await expect(first.getByText(/20\d\d/)).toBeVisible();
    await expect(page.getByText(DRAFT)).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    await page.getByRole("link", { name: /Retour à l'accueil/ }).click();
    await expect(page).toHaveURL("/");
  });

  test("un admin en vue utilisateur ne voit pas non plus le brouillon", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await loginAs(page, "admin");
    await openUserMenu(page);
    await page
      .getByRole("menuitem", { name: "Passer en vue utilisateur" })
      .click();
    await expect(page.getByTestId("view-mode-banner")).toBeVisible();
    expect(await cardTitles(page)).toEqual([PINNED, RECENT, OLDER]);
  });
});

test.describe("annonces côté administration (lecture seule)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin");
  });

  test("la liste montre les 4 annonces dont le brouillon étiqueté, et l'onglet « Annonces » est courant", async ({
    page,
  }) => {
    await page.goto("/admin/announcements");
    await expect(page.getByTestId("admin-announcement-row")).toHaveCount(4);

    const draft = page
      .getByTestId("admin-announcement-row")
      .filter({ hasText: DRAFT });
    await expect(draft.getByText("Brouillon", { exact: true })).toBeVisible();
    await expect(draft.getByText("jamais publiée")).toBeVisible();
    const pinned = page
      .getByTestId("admin-announcement-row")
      .filter({ hasText: PINNED });
    await expect(pinned.getByText("Publiée", { exact: true })).toBeVisible();
    await expect(pinned.getByText("Épinglée", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Publier ${DRAFT}` }),
    ).toBeVisible();

    await expect(
      page
        .getByRole("navigation", { name: "Administration" })
        .getByRole("link", { name: "Annonces" }),
    ).toHaveAttribute("aria-current", "page");
    await expectNoHorizontalScroll(page);
  });

  test("la recherche par titre filtre la liste", async ({ page }) => {
    await page.goto("/admin/announcements");
    await page.getByLabel("Rechercher par titre").fill("BAUX");
    await expect(page.getByTestId("admin-announcement-row")).toHaveCount(1);
  });

  test("le tableau de bord affiche les compteurs d'annonces sans toucher aux autres tuiles", async ({
    page,
  }) => {
    await page.goto("/admin");
    const tiles = page.getByTestId("announcement-tiles");
    await expect(tiles.getByText("Publiées")).toBeVisible();
    await expect(tiles.getByText("Brouillons")).toBeVisible();
    await expect(page.getByTestId("dashboard-tiles")).toBeVisible();
    await expect(page.getByTestId("user-tiles")).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("le formulaire de création : compteur et aperçu en direct", async ({
    page,
  }) => {
    await page.goto("/admin/announcements/new");
    await page.getByLabel("Titre *").fill("Aperçu seulement");
    await page.getByLabel("Texte *").fill("Bonjour\nle monde");
    await expect(page.getByTestId("text-counter")).toContainText(
      "1984 caractères restants",
    );
    const preview = page.getByTestId("announcement-preview");
    await expect(
      preview.getByRole("heading", { level: 3, name: "Aperçu seulement" }),
    ).toBeVisible();
    await expect(page.getByLabel("Publier immédiatement")).toBeChecked();
    await expectNoHorizontalScroll(page);
  });

  test("un identifiant inconnu ou mal formé affiche « Annonce introuvable »", async ({
    page,
  }) => {
    for (const id of ["00000000-0000-4000-8000-0000000000ff", "pas-un-uuid"]) {
      await page.goto(`/admin/announcements/${id}`);
      await expect(
        page.getByRole("heading", { name: "Annonce introuvable" }),
      ).toBeVisible();
    }
  });
});

test.describe("annonces : contrôle d'accès", () => {
  const ADMIN_PATHS = [
    "/admin/announcements",
    "/admin/announcements/new",
    "/admin/announcements/00000000-0000-4000-8000-0000000000a1",
  ];

  test("non connecté : redirigé vers /login avec next", async ({ page }) => {
    await page.goto("/announcements");
    await expect(page).toHaveURL("/login?next=%2Fannouncements");
    await page.goto("/admin/announcements");
    await expect(page).toHaveURL("/login?next=%2Fadmin%2Fannouncements");
  });

  test("un utilisateur simple est renvoyé vers / depuis l'administration", async ({
    page,
  }) => {
    await loginAs(page, "user");
    for (const path of ADMIN_PATHS) {
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
    for (const path of ADMIN_PATHS) {
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
    for (const path of ADMIN_PATHS) {
      await page.goto(path);
      await expect(page).toHaveURL("/");
    }
  });
});
