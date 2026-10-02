import { expect, test, type Page } from "@playwright/test";

import { loginAs } from "./helpers/auth";

const VISIBLE_APPS = [
  "Outil entrepôts",
  "Comptes rendus de visites",
  "Suivi des contrôles réglementaires",
  "Annuaire des sites",
  "Tableau de bord interne",
];

function card(page: Page, name: string) {
  return page
    .getByTestId("app-card")
    .filter({ has: page.getByRole("heading", { level: 2, name }) });
}

async function cardTitles(page: Page): Promise<string[]> {
  await expect(page.getByTestId("app-card").first()).toBeVisible();
  return page
    .getByTestId("app-card")
    .getByRole("heading", { level: 2 })
    .allTextContents();
}

test.describe("catalogue (utilisateur)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "user");
  });

  test("affiche exactement les 5 apps visibles, jamais l'app masquée", async ({
    page,
  }) => {
    expect(await cardTitles(page)).toEqual(VISIBLE_APPS);
    await expect(page.getByText("App masquée de test")).toHaveCount(0);
    await expect(page.getByTestId("result-count")).toHaveText("5 applications");
    await expect(page.getByText(/^Bonjour Camille/)).toBeVisible();
  });

  test("aucune donnée de l'app masquée dans le HTML ni dans la charge RSC envoyée", async ({
    page,
  }) => {
    const html = await (await page.request.get("/")).text();
    const rsc = await (
      await page.request.get("/", { headers: { RSC: "1" } })
    ).text();
    for (const payload of [html, rsc]) {
      expect(payload).toContain("Outil entrepôts");
      expect(payload).not.toContain("App masquée de test");
      expect(payload).not.toContain("app-masquee-de-test");
      expect(payload).not.toContain("example.test/masquee");
    }
  });

  test("la recherche ignore accents et casse", async ({ page }) => {
    await page.getByLabel("Rechercher une application").fill("ENTREPOTS");
    await expect(page.getByTestId("app-card")).toHaveCount(2);
    expect(await cardTitles(page)).toEqual([
      "Outil entrepôts",
      "Comptes rendus de visites",
    ]);
    await expect(page.getByTestId("result-count")).toHaveText("2 applications");
  });

  test("le filtre de catégorie « Référentiel » fonctionne", async ({
    page,
  }) => {
    const chip = page.getByRole("button", { name: "Référentiel" });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(await cardTitles(page)).toEqual([
      "Annuaire des sites",
      "Tableau de bord interne",
    ]);
  });

  test("une recherche sans résultat affiche un message et se réinitialise", async ({
    page,
  }) => {
    await page.getByLabel("Rechercher une application").fill("zzzzzz");
    await expect(
      page.getByText("Aucune application ne correspond à votre recherche."),
    ).toBeVisible();
    await expect(page.getByTestId("app-card")).toHaveCount(0);

    await page
      .getByRole("button", { name: "Réinitialiser les filtres" })
      .click();
    await expect(page.getByTestId("app-card")).toHaveCount(5);
  });

  test("« Outil entrepôts » : lien externe sécurisé (non cliqué), badge, version et documentation", async ({
    page,
  }) => {
    const outil = card(page, "Outil entrepôts");
    const open = outil.getByRole("link", { name: /^Ouvrir/ });
    await expect(open).toHaveAttribute(
      "href",
      "https://example.test/outil-entrepots",
    );
    await expect(open).toHaveAttribute("target", "_blank");
    await expect(open).toHaveAttribute("rel", "noopener noreferrer");
    await expect(outil.getByText("Nouveau")).toBeVisible();
    await expect(outil.getByText("Version 0.1.0")).toBeVisible();
    await expect(outil.getByText("mis à jour il y a 2 h")).toBeVisible();
    await expect(
      outil.getByRole("link", { name: /^Documentation/ }),
    ).toHaveAttribute("rel", "noopener noreferrer");
    await expect(
      outil.getByRole("link", { name: /^Contacter/ }),
    ).toHaveAttribute("href", "mailto:equipe.projet@example.test");
  });

  test("la carte sans URL n'a aucun lien et affiche « Bientôt disponible »", async ({
    page,
  }) => {
    const sansUrl = card(page, "Suivi des contrôles réglementaires");
    await expect(sansUrl.getByRole("link")).toHaveCount(0);
    await expect(
      sansUrl.getByRole("button", { name: "Bientôt disponible" }),
    ).toBeDisabled();
    await expect(sansUrl.getByText("Hors ligne")).toBeVisible();
  });

  test("la carte en maintenance montre son message ; la carte hors ligne garde « Ouvrir »", async ({
    page,
  }) => {
    const maintenance = card(page, "Annuaire des sites");
    await expect(maintenance.getByText("Maintenance")).toBeVisible();
    await expect(
      maintenance.getByText("Mise à jour en cours, retour prévu à 18 h"),
    ).toBeVisible();

    const horsLigne = card(page, "Tableau de bord interne");
    await expect(horsLigne.getByText("Hors ligne")).toBeVisible();
    await expect(
      horsLigne.getByRole("link", { name: /^Ouvrir/ }),
    ).toBeVisible();
  });

  test("aucun défilement horizontal", async ({ page }) => {
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("?q= et ?cat= restaurent la vue, et la saisie met l'URL à jour", async ({
    page,
  }) => {
    await page.goto("/?q=annuaire");
    await expect(page.getByLabel("Rechercher une application")).toHaveValue(
      "annuaire",
    );
    expect(await cardTitles(page)).toEqual(["Annuaire des sites"]);

    await page.goto("/?cat=" + encodeURIComponent("Entrepôts"));
    await expect(
      page.getByRole("button", { name: "Entrepôts" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(await cardTitles(page)).toEqual([
      "Outil entrepôts",
      "Comptes rendus de visites",
    ]);

    await page.goto("/?cat=Inconnue");
    await expect(page.getByRole("button", { name: "Toutes" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("app-card")).toHaveCount(5);

    await page.getByLabel("Rechercher une application").fill("outil");
    await expect(page).toHaveURL(/\?q=outil/);
  });
});

test("un admin ne voit pas non plus l'app masquée sur l'accueil", async ({
  page,
}) => {
  await loginAs(page, "admin");
  expect(await cardTitles(page)).toEqual(VISIBLE_APPS);
  await expect(page.getByText("App masquée de test")).toHaveCount(0);
});
