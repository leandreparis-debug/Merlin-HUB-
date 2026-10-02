import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import { ACCOUNTS, loginAs, submitLogin } from "./helpers/auth";

// Ces tests modifient des comptes : projet « mutations » (après les autres, en
// série, desktop). Il n'y a pas de suppression de compte en V1 : en fin de
// test, les comptes créés sont **désactivés** ; ils disparaissent au
// redémarrage du serveur mémoire. Les comptes de dev `admin`, `user` et
// `desactive` ne sont jamais modifiés (`nouveau` n'est utilisé que par le test
// de changement forcé du mot de passe provisoire).
test.describe.configure({ mode: "serial" });

const NEW_PASSWORD = "Correct-Horse-Battery-42";
const OTHER_PASSWORD = "Another-Sturdy-Passphrase-7";

const unique = () =>
  `test-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Created {
  id: string;
  email: string;
  password: string;
}

let created: Created[] = [];
const contexts: BrowserContext[] = [];

test.beforeEach(async ({ page }) => {
  created = [];
  await loginAs(page, "admin");
});

// Nettoyage garanti : désactive les comptes créés, même si le test échoue.
test.afterEach(async ({ page }) => {
  for (const context of contexts.splice(0))
    await context.close().catch(() => undefined);
  for (const account of created) {
    try {
      await page.goto(`/admin/users/${account.id}`);
      const confirm = page.getByLabel(/confirme la désactivation/);
      if (await confirm.isVisible({ timeout: 5_000 })) {
        await confirm.check();
        await page
          .getByRole("button", { name: "Désactiver le compte" })
          .click();
        await expect(page.getByText(/Le compte a été désactivé/)).toBeVisible();
      }
    } catch (error) {
      console.error(`Nettoyage impossible pour ${account.email} :`, error);
    }
  }
});

/** Crée un compte par l'interface et lit le mot de passe provisoire du panneau. */
async function createUser(
  page: Page,
  options: { role?: "user" | "admin"; email?: string } = {},
): Promise<Created> {
  const email = options.email ?? `${unique()}@example.test`;
  await page.goto("/admin/users/new");
  await page.getByLabel("Email professionnel *").fill(email);
  await page.getByLabel("Nom complet").fill("Compte de test");
  if (options.role) await page.getByLabel("Rôle").selectOption(options.role);
  await page.getByRole("button", { name: "Créer le compte" }).click();

  const password = (
    await page.getByTestId("provisional-password").textContent()
  )?.trim();
  expect(password).toHaveLength(20);
  const href = await page
    .getByRole("link", { name: /Voir la fiche/ })
    .getAttribute("href");
  const id = /\/admin\/users\/([0-9a-f-]{36})/.exec(href ?? "")?.[1] ?? "";
  const account = { id, email, password: password ?? "" };
  created.push(account);
  return account;
}

/** Ouvre une session indépendante (nouveau contexte) pour le compte donné. */
async function openSession(
  browser: Browser,
  baseURL: string | undefined,
): Promise<{ page: Page; context: BrowserContext }> {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
  });
  contexts.push(context);
  return { page: await context.newPage(), context };
}

async function changePasswordAtFirstLogin(
  page: Page,
  current: string,
  next: string,
) {
  await expect(page).toHaveURL("/change-password");
  await page.getByLabel("Mot de passe actuel").fill(current);
  await page.getByLabel("Nouveau mot de passe", { exact: true }).fill(next);
  await page.getByLabel("Confirmer le nouveau mot de passe").fill(next);
  await page.getByRole("button", { name: "Changer mon mot de passe" }).click();
  await expect(page).toHaveURL("/");
}

async function resetPasswordOf(page: Page, account: Created): Promise<string> {
  await page.goto(`/admin/users/${account.id}`);
  await page.getByLabel(/confirme la réinitialisation/).check();
  await page
    .getByRole("button", { name: "Réinitialiser le mot de passe" })
    .click();
  const password = (
    await page.getByTestId("provisional-password").textContent()
  )?.trim();
  expect(password).toHaveLength(20);
  return password ?? "";
}

test("création : mot de passe affiché une seule fois (absent après rechargement), première connexion forcée au changement", async ({
  page,
  browser,
  baseURL,
}) => {
  const account = await createUser(page);

  // Le panneau avertit, puis le rechargement fait disparaître le secret.
  await expect(page.getByTestId("provisional-panel")).toContainText(
    "Ce mot de passe ne sera plus affiché",
  );
  expect(page.url()).not.toContain(account.password);
  await page.reload();
  await expect(page.getByTestId("provisional-password")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(account.password);
  const html = await (await page.request.get(page.url())).text();
  expect(html).not.toContain(account.password);

  // Première connexion du nouvel utilisateur : changement forcé.
  const session = await openSession(browser, baseURL);
  await session.page.goto("/login");
  await submitLogin(session.page, account.email, account.password);
  await changePasswordAtFirstLogin(
    session.page,
    account.password,
    NEW_PASSWORD,
  );
  await expect(
    session.page.getByRole("heading", { name: "Vos applications" }),
  ).toBeVisible();

  // Le compte apparaît dans la liste, première connexion plus en attente.
  await page.goto(`/admin/users?q=${encodeURIComponent(account.email)}`);
  const row = page.getByTestId("user-row").filter({ hasText: account.email });
  await expect(row).toHaveCount(1);
  await expect(row.getByText("Première connexion en attente")).toHaveCount(0);
});

test("un email déjà utilisé donne une erreur sur le champ", async ({
  page,
}) => {
  const account = await createUser(page);
  await page
    .getByRole("button", { name: "Créer un autre utilisateur" })
    .click();
  await page
    .getByLabel("Email professionnel *")
    .fill(account.email.toUpperCase());
  await page.getByRole("button", { name: "Créer le compte" }).click();

  const field = page.getByLabel("Email professionnel *");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#email-error")).toHaveText(
    "Un compte existe déjà avec cet email",
  );
  await expect(page.getByTestId("provisional-password")).toHaveCount(0);
});

test("réinitialisation : l'ancien mot de passe échoue, le nouveau provisoire fonctionne et force à nouveau le changement", async ({
  page,
  browser,
  baseURL,
}) => {
  const account = await createUser(page);
  const session = await openSession(browser, baseURL);
  await session.page.goto("/login");
  await submitLogin(session.page, account.email, account.password);
  await changePasswordAtFirstLogin(
    session.page,
    account.password,
    NEW_PASSWORD,
  );

  const provisional = await resetPasswordOf(page, account);
  expect(provisional).not.toBe(account.password);
  await page.getByRole("button", { name: /J'ai noté/ }).click();
  await expect(page.getByTestId("provisional-password")).toHaveCount(0);

  // Une session déjà ouverte est renvoyée vers le changement de mot de passe.
  await session.page.goto("/");
  await expect(session.page).toHaveURL("/change-password");

  const fresh = await openSession(browser, baseURL);
  await fresh.page.goto("/login");
  await submitLogin(fresh.page, account.email, NEW_PASSWORD);
  await expect(fresh.page.locator('form [role="alert"]')).toHaveText(
    "Email ou mot de passe incorrect",
  );

  await fresh.page
    .getByLabel("Mot de passe", { exact: true })
    .fill(provisional);
  await fresh.page.getByRole("button", { name: "Se connecter" }).click();
  await changePasswordAtFirstLogin(fresh.page, provisional, OTHER_PASSWORD);
});

test("désactivation : session ouverte bloquée, message « compte désactivé » à la connexion, réactivation", async ({
  page,
  browser,
  baseURL,
}) => {
  const account = await createUser(page);
  const session = await openSession(browser, baseURL);
  await session.page.goto("/login");
  await submitLogin(session.page, account.email, account.password);
  await changePasswordAtFirstLogin(
    session.page,
    account.password,
    NEW_PASSWORD,
  );

  await page.goto(`/admin/users/${account.id}`);
  const deactivate = page.getByRole("button", { name: "Désactiver le compte" });
  await expect(deactivate).toBeDisabled();
  await page.getByLabel(/confirme la désactivation/).check();
  await deactivate.click();
  await expect(page.getByText(/Le compte a été désactivé/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Réactiver le compte" }),
  ).toBeVisible();

  // Session déjà ouverte : renvoyée vers /login à la requête suivante.
  await session.page.goto("/");
  await expect(session.page).toHaveURL(/\/login/);

  // Mot de passe correct : message dédié.
  await submitLogin(session.page, account.email, NEW_PASSWORD);
  await expect(session.page.locator('form [role="alert"]')).toHaveText(
    "Ce compte est désactivé. Contactez l'administrateur.",
  );

  // Réactivation : la connexion refonctionne.
  await page.getByRole("button", { name: "Réactiver le compte" }).click();
  await expect(page.getByText("Le compte a été réactivé.")).toBeVisible();
  await session.page
    .getByLabel("Mot de passe", { exact: true })
    .fill(NEW_PASSWORD);
  await session.page.getByRole("button", { name: "Se connecter" }).click();
  await expect(session.page).toHaveURL("/");
});

test("rôle : promu admin le compte accède à /admin, rétrogradé il n'y accède plus", async ({
  page,
  browser,
  baseURL,
}) => {
  const account = await createUser(page);
  const session = await openSession(browser, baseURL);
  await session.page.goto("/login");
  await submitLogin(session.page, account.email, account.password);
  await changePasswordAtFirstLogin(
    session.page,
    account.password,
    NEW_PASSWORD,
  );

  await session.page.goto("/admin");
  await expect(session.page).toHaveURL("/");

  await page.goto(`/admin/users/${account.id}`);
  await page.locator("#user-role").selectOption("admin");
  await page.getByRole("button", { name: "Changer le rôle" }).click();
  await expect(
    page.getByText(/Rôle modifié : Utilisateur → Admin/),
  ).toBeVisible();

  await session.page.goto("/admin");
  await expect(
    session.page.getByRole("heading", { name: "Administration", exact: true }),
  ).toBeVisible();

  await page.locator("#user-role").selectOption("user");
  await page.getByRole("button", { name: "Changer le rôle" }).click();
  await expect(
    page.getByText(/Rôle modifié : Admin → Utilisateur/),
  ).toBeVisible();

  await session.page.goto("/admin");
  await expect(session.page).toHaveURL("/");
});

test("auto-protection : sur sa propre fiche, des actions forgées sont refusées par le serveur", async ({
  page,
}) => {
  await page.goto("/admin/users");
  await page
    .getByTestId("user-row")
    .filter({ hasText: ACCOUNTS.admin.email })
    .getByRole("link", { name: /Gérer/ })
    .click();
  await expect(page.locator("#user-role")).toBeDisabled();

  // Désactivation forgée : soumission directe du formulaire malgré les contrôles désactivés.
  await page.evaluate(() =>
    (document.querySelector("#confirm-deactivate") as HTMLInputElement)
      .closest("form")
      ?.requestSubmit(),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "propre compte" }),
  ).toBeVisible();

  // Rétrogradation forgée : on réactive le sélecteur et on force la valeur.
  await page.evaluate(() => {
    const select = document.querySelector("#user-role") as HTMLSelectElement;
    select.disabled = false;
    select.value = "user";
    select.closest("form")?.requestSubmit();
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "propre rôle" }),
  ).toBeVisible();

  // Réinitialisation forgée.
  await page.evaluate(() =>
    (document.querySelector("#confirm-reset") as HTMLInputElement)
      .closest("form")
      ?.requestSubmit(),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "Changer mon mot de passe" }),
  ).toBeVisible();

  // Rien n'a changé : le compte reste admin et actif, avec le même mot de passe.
  await page.reload();
  await expect(page.getByText("Actif", { exact: true }).first()).toBeVisible();
  await expect(page.locator("#user-role")).toHaveValue("admin");
});

test("compte de dev « nouveau » : changement forcé du mot de passe provisoire, puis accès au site", async ({
  browser,
  baseURL,
}) => {
  const session = await openSession(browser, baseURL);
  await session.page.goto("/login");
  await submitLogin(
    session.page,
    ACCOUNTS.nouveau.email,
    ACCOUNTS.nouveau.password,
  );
  await expect(session.page).toHaveURL("/change-password");
  await expect(
    session.page.getByText(
      "Pour votre sécurité, choisissez un nouveau mot de passe avant de continuer",
    ),
  ).toBeVisible();

  await session.page.goto("/");
  await expect(session.page).toHaveURL("/change-password");

  await session.page.getByLabel("Mot de passe actuel").fill("mauvais");
  await session.page
    .getByLabel("Nouveau mot de passe", { exact: true })
    .fill("Bonjour-Les-Collegues-42");
  await session.page
    .getByLabel("Confirmer le nouveau mot de passe")
    .fill("Bonjour-Les-Collegues-42");
  await session.page
    .getByRole("button", { name: "Changer mon mot de passe" })
    .click();
  await expect(session.page.locator('form [role="alert"]')).toHaveText(
    "Le mot de passe actuel est incorrect.",
  );

  await session.page
    .getByLabel("Mot de passe actuel")
    .fill(ACCOUNTS.nouveau.password);
  await session.page
    .getByLabel("Nouveau mot de passe", { exact: true })
    .fill("Bonjour-Les-Collegues-42");
  await session.page
    .getByLabel("Confirmer le nouveau mot de passe")
    .fill("Bonjour-Les-Collegues-42");
  await session.page
    .getByRole("button", { name: "Changer mon mot de passe" })
    .click();
  // Le paramètre `notice` est retiré de l'URL après affichage du message.
  await expect(session.page).toHaveURL("/");
  await expect(session.page.getByRole("status")).toContainText(
    "Votre mot de passe a bien été modifié.",
  );
});
