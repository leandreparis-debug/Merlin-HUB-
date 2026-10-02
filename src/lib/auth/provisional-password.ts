import { randomInt } from "node:crypto";

import { validateNewPassword } from "@/lib/auth/password-policy";

/** Longueur d'un mot de passe provisoire. */
export const PROVISIONAL_PASSWORD_LENGTH = 20;

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+";

/**
 * Alphabet des mots de passe provisoires : sans caractères ambigus
 * (`0 O 1 l I`), avec lettres, chiffres et symboles simples.
 */
export const PROVISIONAL_PASSWORD_ALPHABET = `${UPPER}${LOWER}${DIGITS}${SYMBOLS}`;

/** Symboles possibles (au moins un par mot de passe provisoire). */
export const PROVISIONAL_PASSWORD_SYMBOLS = SYMBOLS;

/**
 * Génère une chaîne aléatoire à partir du générateur cryptographique de Node
 * (`crypto.randomInt`, jamais `Math.random`). Aucune contrainte de
 * composition : voir {@link generateProvisionalPassword}.
 */
export function generatePassword(length = PROVISIONAL_PASSWORD_LENGTH): string {
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password +=
      PROVISIONAL_PASSWORD_ALPHABET[
        randomInt(PROVISIONAL_PASSWORD_ALPHABET.length)
      ];
  }
  return password;
}

/**
 * Génère un mot de passe provisoire de 20 caractères avec au moins une
 * majuscule, une minuscule, un chiffre et un symbole. Il est régénéré s'il
 * viole la politique de mot de passe (notamment s'il contient la partie
 * locale de l'email, insensible à la casse).
 */
export function generateProvisionalPassword(email: string): string {
  for (;;) {
    const candidate = generatePassword(PROVISIONAL_PASSWORD_LENGTH);
    const mixed =
      /[A-Z]/.test(candidate) &&
      /[a-z]/.test(candidate) &&
      /[0-9]/.test(candidate) &&
      [...SYMBOLS].some((symbol) => candidate.includes(symbol));
    if (!mixed) continue;
    if (
      !validateNewPassword({
        newPassword: candidate,
        currentPassword: "",
        email,
      }).ok
    ) {
      continue;
    }
    return candidate;
  }
}
