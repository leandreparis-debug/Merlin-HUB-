import { expect, test, type Browser, type Page } from "@playwright/test";

import { ACCOUNTS, loginAs } from "./helpers/auth";

// Ces tests modifient des données : projet « mutations » (après les autres, en
// série, desktop). Chaque annonce créée a un titre unique et est supprimée en
// fin de test, même en cas d'échec : l'état initial (4 annonces de démo) est
// restauré.
test.describe.configure({ mode: "serial" });

const unique = (prefix: string) =>
  `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let created: { id: string; title: string }[] = [];

test.beforeEach(async ({ page }) => {
  created = [];
  await loginAs(page, "admin");
});

// Nettoyage garanti : supprime les annonces créées, même si le test échoue.
test.afterEach(async ({ page }) => {
  for (const item of created) {
    try {
      await page.goto(`/admin/announcements/${item.id}`);
      if (
        await page
          .getByRole("heading", { name: "Annonce introuvable" })
          .isVisible()
      ) {
        continue;
      }
      await page.getByText("Supprimer cette annonce").click();
      await page.getByLabel(/Je confirme la suppression/).check();
      await page
        .getByRole("button", { name: "Supprimer définitivement" })
        .click();
      await expect(page).toHaveURL(/\/admin\/announcements\?notice=deleted/);
    } catch (error) {
      console.error(`Nettoyage impossible pour « ${item.title} » :`, error);
    }
  }
});

async function createAnnouncement(
  page: Page,
  options: {
    title: string;
    text?: string;
    pinned?: boolean;
    published?: boolean;
  },
): Promise<string> {
  await page.goto("/admin/announcements/new");
  await page.getByLabel("Titre *").fill(options.title);
  await page.getByLabel("Texte *").fill(options.text ?? "Texte de test");
  if (options.pinned) await page.getByLabel("Épingler").check();
  if (options.published === false) {
    await page.getByLabel("Publier immédiatement").uncheck();
  }
  await page.getByRole("button", { name: "Créer l'annonce" }).click();
  await expect(page).toHaveURL(
    /\/admin\/announcements\/[0-9a-f-]{36}\?notice=created/,
  );
  const id = /\/announcements\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
  created.push({ id, title: options.title });
  await expect(page.getByText("L'annonce a été créée.")).toBeVisible();
  return id;
}

/** Ouvre une session « utilisateur » indépendante (nouvelle session). */
async function userSession(browser: Browser, baseURL: string | undefined) {
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

function homeTitles(page: Page) {
  return page
    .getByTestId("announcements-zone")
    .getByTestId("announcement-card")
    .getByRole("heading", { level: 3 })
    .allTextContents();
}

test("une annonce créée et publiée est visible d'un utilisateur dans une nouvelle session", async ({
  page,
  browser,
  baseURL,
}) => {
  const title = unique("Annonce publiée");
  await createAnnouncement(page, { title, text: "Bonjour à tous" });

  const user = await userSession(browser, baseURL);
  try {
    await expect(
      user.page.getByTestId("announcement-card").filter({ hasText: title }),
    ).toBeVisible();
    await user.page.goto("/announcements");
    await expect(user.page.getByText(title)).toBeVisible();
    await expect(user.page.getByText("Bonjour à tous")).toBeVisible();
  } finally {
    await user.close();
  }
});

test("une annonce épinglée passe en premier ; désépinglée, elle revient à sa place", async ({
  page,
  browser,
  baseURL,
}) => {
  const title = unique("Épinglée de test");
  const id = await createAnnouncement(page, { title, pinned: true });

  const user = await userSession(browser, baseURL);
  try {
    // Deux épinglées : la plus récemment publiée d'abord.
    expect((await homeTitles(user.page))[0]).toBe(title);
    await expect(
      user.page
        .getByTestId("announcement-card")
        .filter({ hasText: title })
        .getByText("Épinglée"),
    ).toBeVisible();

    await page.goto(`/admin/announcements/${id}`);
    await page.getByRole("button", { name: `Désépingler ${title}` }).click();
    await expect(page.getByTestId("announcement-state-message")).toContainText(
      "n'est plus épinglée",
    );

    await user.page.reload();
    const titles = await homeTitles(user.page);
    expect(titles[0]).toBe("Bienvenue sur Merlin");
    expect(titles).toContain(title);
  } finally {
    await user.close();
  }
});

test("un brouillon est invisible d'un utilisateur ; publié il apparaît, dépublié il disparaît", async ({
  page,
  browser,
  baseURL,
}) => {
  const title = unique("Brouillon e2e");
  const text = unique("texte-secret");
  const id = await createAnnouncement(page, {
    title,
    text,
    published: false,
  });

  const user = await userSession(browser, baseURL);
  try {
    for (const path of ["/", "/announcements"]) {
      await user.page.goto(path);
      const html = await (await user.page.request.get(path)).text();
      expect(html).not.toContain(text);
      await expect(user.page.getByText(title)).toHaveCount(0);
    }

    await page.goto(`/admin/announcements/${id}`);
    await page.getByRole("button", { name: `Publier ${title}` }).click();
    await expect(page.getByTestId("announcement-state-message")).toContainText(
      "est publiée",
    );
    await user.page.goto("/announcements");
    await expect(user.page.getByText(title)).toBeVisible();

    await page.getByRole("button", { name: `Dépublier ${title}` }).click();
    await expect(page.getByTestId("announcement-state-message")).toContainText(
      "est dépubliée",
    );
    await user.page.reload();
    await expect(user.page.getByText(title)).toHaveCount(0);
  } finally {
    await user.close();
  }
});

test("modifier le texte est répercuté côté utilisateur ; la date de publication ne change pas", async ({
  page,
  browser,
  baseURL,
}) => {
  const title = unique("À modifier");
  const id = await createAnnouncement(page, { title, text: "Avant" });

  await page.goto(`/admin/announcements/${id}`);
  const dateBefore = await page
    .getByText(/publiée .*\(/)
    .first()
    .textContent();
  await page.getByLabel("Texte *").fill("Après modification");
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(page.getByText("L'annonce a été enregistrée.")).toBeVisible();

  const user = await userSession(browser, baseURL);
  try {
    await expect(
      user.page.getByTestId("announcement-card").filter({ hasText: title }),
    ).toContainText("Après modification");
  } finally {
    await user.close();
  }
  await page.reload();
  expect(
    await page
      .getByText(/publiée .*\(/)
      .first()
      .textContent(),
  ).toBe(dateBefore);
});

test("du HTML saisi est affiché littéralement, sans exécution", async ({
  page,
  browser,
  baseURL,
}) => {
  const title = unique("HTML");
  await createAnnouncement(page, {
    title,
    text: "<img src=x onerror=alert(1)>",
  });

  const user = await userSession(browser, baseURL);
  let dialogs = 0;
  user.page.on("dialog", async (dialog) => {
    dialogs += 1;
    await dialog.dismiss();
  });
  try {
    await user.page.reload();
    const card = user.page
      .getByTestId("announcement-card")
      .filter({ hasText: title });
    await expect(card).toContainText("<img src=x onerror=alert(1)>");
    await expect(card.locator("img")).toHaveCount(0);
    expect(dialogs).toBe(0);
  } finally {
    await user.close();
  }
});

test("la suppression exige la confirmation puis l'annonce disparaît partout", async ({
  page,
  browser,
  baseURL,
}) => {
  const title = unique("À supprimer");
  const id = await createAnnouncement(page, { title });

  await page.goto(`/admin/announcements/${id}`);
  await page.getByText("Supprimer cette annonce").click();
  const button = page.getByRole("button", { name: "Supprimer définitivement" });
  await expect(button).toBeDisabled();
  await page.getByLabel(/Je confirme la suppression/).check();
  await button.click();
  await expect(page).toHaveURL(/\/admin\/announcements\?notice=deleted/);
  await expect(page.getByText("L'annonce a été supprimée.")).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);

  const user = await userSession(browser, baseURL);
  try {
    await user.page.goto("/announcements");
    await expect(user.page.getByText(title)).toHaveCount(0);
    await expect(user.page.getByText(title)).toHaveCount(0);
  } finally {
    await user.close();
  }

  await page.goto(`/admin/announcements/${id}`);
  await expect(
    page.getByRole("heading", { name: "Annonce introuvable" }),
  ).toBeVisible();
});

test("épingler une 4e annonce affiche un avertissement sans bloquer", async ({
  page,
}) => {
  const ids: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    ids.push(
      await createAnnouncement(page, {
        title: unique(`Pin ${index}`),
        pinned: true,
      }),
    );
  }
  // La démo en contient déjà une : au moins 4 sont épinglées.
  await page.goto("/admin/announcements/new");
  await page.getByLabel("Épingler").check();
  await expect(page.getByTestId("pin-warning")).toBeVisible();
});

test("l'état initial est restauré : seules les 4 annonces de démo subsistent", async ({
  page,
}) => {
  await page.goto("/admin/announcements");
  await expect(page.getByTestId("admin-announcement-row")).toHaveCount(4);
});
