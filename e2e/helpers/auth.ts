import { expect, type Page } from "@playwright/test";

/** Comptes de développement de l'authentification mémoire (factices, dev/e2e uniquement). */
export const ACCOUNTS = {
  admin: { email: "admin@example.test", password: "Admin-Password-123" },
  user: { email: "user@example.test", password: "User-Password-123" },
  nouveau: { email: "nouveau@example.test", password: "Temp-Password-1234" },
  desactive: { email: "desactive@example.test", password: "Disabled-Pass-123" },
} as const;

export type AccountName = keyof typeof ACCOUNTS;

/** Remplit et soumet le formulaire de connexion (sans attendre de résultat). */
export async function submitLogin(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/** Se connecte avec un compte de dev et attend l'accueil (comptes sans changement de mot de passe forcé). */
export async function loginAs(page: Page, account: AccountName): Promise<void> {
  await page.goto("/login");
  const { email, password } = ACCOUNTS[account];
  await submitLogin(page, email, password);
  await expect(page).toHaveURL("/");
}

/** Ouvre le menu utilisateur de l'en-tête. */
export async function openUserMenu(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Menu utilisateur/ }).click();
  await expect(page.getByRole("menu")).toBeVisible();
}
