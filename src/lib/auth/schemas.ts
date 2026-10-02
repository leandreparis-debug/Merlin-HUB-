import { z } from "zod";

import { PASSWORD_MAX_LENGTH } from "@/lib/auth/password-policy";

/** Saisie du formulaire de connexion : email normalisé en minuscules, mot de passe non vide. */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
