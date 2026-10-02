import { z } from "zod";

/** Longueur minimale d'un mot de passe. */
export const PASSWORD_MIN_LENGTH = 12;
/** Longueur maximale d'un mot de passe. */
export const PASSWORD_MAX_LENGTH = 128;

/** Plus court qu'ici, la partie locale d'un email n'est pas testée (trop de faux positifs). */
const MIN_LOCAL_PART_LENGTH = 3;

/** Schéma zod de la longueur d'un mot de passe (pas de règle de composition). */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    message: `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`,
  });

/** Résultat de {@link validateNewPassword}. */
export type PasswordValidation = { ok: true } | { ok: false; error: string };

/**
 * Applique la politique de mot de passe : 12 à 128 caractères, différent de
 * l'actuel, sans la partie locale de l'email (casse ignorée).
 */
export function validateNewPassword(input: {
  newPassword: string;
  currentPassword: string;
  email: string;
}): PasswordValidation {
  const parsed = passwordSchema.safeParse(input.newPassword);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Mot de passe invalide.",
    };
  }
  if (input.newPassword === input.currentPassword) {
    return {
      ok: false,
      error: "Le nouveau mot de passe doit être différent de l'actuel.",
    };
  }
  const localPart = (input.email.split("@")[0] ?? "").trim().toLowerCase();
  if (
    localPart.length >= MIN_LOCAL_PART_LENGTH &&
    input.newPassword.toLowerCase().includes(localPart)
  ) {
    return {
      ok: false,
      error: "Le mot de passe ne doit pas contenir votre identifiant email.",
    };
  }
  return { ok: true };
}
