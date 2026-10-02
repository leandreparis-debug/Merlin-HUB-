import { expect, test } from "@playwright/test";

import { loginAs } from "./helpers/auth";

test.describe("page d'accueil", () => {
  test("se charge, affiche le titre, sans défilement horizontal, avec la bonne grille", async ({
    page,
  }, testInfo) => {
    await loginAs(page, "user");

    await expect(
      page.getByRole("heading", { name: "Bienvenue sur Merlin" }),
    ).toBeVisible();

    const hasHorizontalScroll = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(hasHorizontalScroll).toBe(false);

    const expectedColumns: Record<string, number> = {
      mobile: 1,
      tablet: 2,
      desktop: 3,
    };
    const expectedColumnCount = expectedColumns[testInfo.project.name];
    expect(expectedColumnCount).toBeDefined();

    const cards = page.getByTestId("app-grid").locator("> div");
    await expect(cards).toHaveCount(3);

    const boxes = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().top),
    );
    const firstRowTop = boxes[0];
    const columnsInFirstRow = boxes.filter((top) => top === firstRowTop).length;

    expect(columnsInFirstRow).toBe(expectedColumnCount);
  });
});

test("le lien d'évitement reçoit le focus au premier Tab", async ({ page }) => {
  await loginAs(page, "user");
  // Rechargement complet : après la navigation douce, le point de départ du
  // focus séquentiel n'est plus en haut de la page.
  await page.goto("/");
  await page.keyboard.press("Tab");

  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
});

test("/robots.txt interdit tout", async ({ page }) => {
  const response = await page.goto("/robots.txt");
  expect(response?.status()).toBe(200);

  const body = await response?.text();
  expect(body).toContain("Disallow: /");
});

test("/api/health répond 200 avec le statut ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.app).toBe("merlin");
});

test("une URL inexistante affiche la page 404 personnalisée, sans connexion", async ({
  page,
}) => {
  const response = await page.goto("/une-page-qui-n-existe-pas");
  expect(response?.status()).toBe(404);

  await expect(
    page.getByRole("heading", { name: "Cette page n'existe pas" }),
  ).toBeVisible();
});
