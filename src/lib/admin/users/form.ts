import { z } from "zod";

import type { FieldErrors } from "@/lib/admin/apps/action-result";
import { createProfileInputSchema } from "@/lib/data/schemas";
import type { Role } from "@/lib/data/types";

const fullNameSchema = z
  .string()
  .trim()
  .max(80, { message: "Le nom ne doit pas dépasser 80 caractères" });

const roleSchema = z.enum(["user", "admin"], { message: "Rôle invalide" });

/** Création d'un compte : compose le schéma d'email existant avec nom et rôle. */
const createUserSchema = createProfileInputSchema
  .omit({ id: true, fullName: true, role: true })
  .extend({ fullName: fullNameSchema, role: roleSchema });

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Premier message d'erreur par champ d'un échec zod. */
function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (!(field in errors)) errors[field] = issue.message;
  }
  return errors;
}

/** Valide le formulaire de création (email normalisé, nom ≤ 80, rôle). */
export function parseCreateUserForm(
  formData: FormData,
):
  | { ok: true; email: string; fullName: string | null; role: Role }
  | { ok: false; fieldErrors: FieldErrors } {
  const result = createUserSchema.safeParse({
    email: text(formData, "email"),
    fullName: text(formData, "fullName"),
    role: text(formData, "role") || "user",
  });
  if (!result.success) {
    return { ok: false, fieldErrors: fieldErrorsOf(result.error) };
  }
  return {
    ok: true,
    email: result.data.email,
    fullName: result.data.fullName === "" ? null : result.data.fullName,
    role: result.data.role,
  };
}

/** Valide le nom complet d'une modification (≤ 80, vide = pas de nom). */
export function parseFullName(
  formData: FormData,
):
  | { ok: true; fullName: string | null }
  | { ok: false; fieldErrors: FieldErrors } {
  const result = fullNameSchema.safeParse(text(formData, "fullName"));
  if (!result.success) {
    return {
      ok: false,
      fieldErrors: {
        fullName: result.error.issues[0]?.message ?? "Nom invalide",
      },
    };
  }
  return { ok: true, fullName: result.data === "" ? null : result.data };
}

/** Valide un rôle de formulaire. */
export function parseRole(
  formData: FormData,
): { ok: true; role: Role } | { ok: false; fieldErrors: FieldErrors } {
  const result = roleSchema.safeParse(text(formData, "role"));
  if (!result.success) {
    return {
      ok: false,
      fieldErrors: { role: result.error.issues[0]?.message ?? "Rôle invalide" },
    };
  }
  return { ok: true, role: result.data };
}
