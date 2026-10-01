/**
 * Schémas zod pour toutes les entrées d'écriture de la couche de données.
 * Reprennent les mêmes contraintes que les `CHECK` SQL (longueurs, formats)
 * pour que la validation échoue de manière identique côté application et
 * côté base — avec des messages d'erreur en français. Utilisés par les
 * implémentations de repository (Supabase et mémoire) avant toute écriture.
 */
import { z } from "zod";

/** URL `http://` ou `https://` uniquement (refuse `javascript:`, `data:`, etc.). */
const httpUrlSchema = z
  .string()
  .trim()
  .max(500, { message: "L'URL ne doit pas dépasser 500 caractères" })
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "URL invalide" });
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        message: "L'URL doit commencer par http:// ou https://",
      });
    }
  });

/** Email normalisé (recadré, en minuscules) et borné à 254 caractères. */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: "Adresse email invalide" })
  .max(254, { message: "L'adresse email ne doit pas dépasser 254 caractères" });

/** Slug d'application : minuscules, chiffres et tirets simples, 2 à 60 caractères. */
const slugSchema = z
  .string()
  .trim()
  .min(2, { message: "Le slug doit contenir au moins 2 caractères" })
  .max(60, { message: "Le slug ne doit pas dépasser 60 caractères" })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message:
      "Le slug doit être en minuscules, avec chiffres et tirets uniquement (ex. mon-application)",
  });

/** Nom d'icône lucide-react en kebab-case (ex. `app-window`). */
const iconSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, {
    message: "Le nom d'icône doit être en kebab-case (ex. app-window)",
  });

const uuidSchema = z.string().uuid({ message: "Identifiant invalide" });

/** Entrée de création d'une application. */
export const createAppInputSchema = z.object({
  slug: slugSchema,
  name: z
    .string()
    .trim()
    .min(1, { message: "Le nom est requis" })
    .max(80, { message: "Le nom ne doit pas dépasser 80 caractères" }),
  description: z
    .string()
    .trim()
    .max(200, { message: "La description ne doit pas dépasser 200 caractères" })
    .optional(),
  icon: iconSchema.optional(),
  category: z
    .string()
    .trim()
    .min(1, { message: "La catégorie est requise" })
    .max(40, { message: "La catégorie ne doit pas dépasser 40 caractères" })
    .optional(),
  url: httpUrlSchema.nullable().optional(),
  version: z
    .string()
    .trim()
    .max(30, { message: "La version ne doit pas dépasser 30 caractères" })
    .nullable()
    .optional(),
  isNew: z.boolean().optional(),
  ownerName: z
    .string()
    .trim()
    .max(80, {
      message: "Le nom du responsable ne doit pas dépasser 80 caractères",
    })
    .nullable()
    .optional(),
  ownerEmail: emailSchema.nullable().optional(),
  docUrl: httpUrlSchema.nullable().optional(),
  isHidden: z.boolean().optional(),
});

/** Correctif partiel appliqué à une application existante. */
export const updateAppInputSchema = z.object({
  slug: slugSchema.optional(),
  name: z
    .string()
    .trim()
    .min(1, { message: "Le nom est requis" })
    .max(80, { message: "Le nom ne doit pas dépasser 80 caractères" })
    .optional(),
  description: z
    .string()
    .trim()
    .max(200, { message: "La description ne doit pas dépasser 200 caractères" })
    .optional(),
  icon: iconSchema.optional(),
  category: z
    .string()
    .trim()
    .min(1, { message: "La catégorie est requise" })
    .max(40, { message: "La catégorie ne doit pas dépasser 40 caractères" })
    .optional(),
  url: httpUrlSchema.nullable().optional(),
  version: z
    .string()
    .trim()
    .max(30, { message: "La version ne doit pas dépasser 30 caractères" })
    .nullable()
    .optional(),
  isNew: z.boolean().optional(),
  ownerName: z
    .string()
    .trim()
    .max(80, {
      message: "Le nom du responsable ne doit pas dépasser 80 caractères",
    })
    .nullable()
    .optional(),
  ownerEmail: emailSchema.nullable().optional(),
  docUrl: httpUrlSchema.nullable().optional(),
  isHidden: z.boolean().optional(),
});

/** Note facultative accompagnant un changement de statut d'application. */
export const setAppStatusInputSchema = z.object({
  note: z
    .string()
    .trim()
    .max(300, { message: "La note ne doit pas dépasser 300 caractères" })
    .nullable()
    .optional(),
  changedBy: uuidSchema.nullable().optional(),
});

/** Entrée de création d'un profil (implémentation mémoire uniquement). */
export const createProfileInputSchema = z.object({
  id: uuidSchema,
  email: emailSchema,
  fullName: z.string().trim().nullable().optional(),
  role: z.enum(["user", "admin"]).optional(),
});

/** Correctif partiel appliqué à un profil existant. */
export const updateProfileInputSchema = z.object({
  fullName: z.string().trim().nullable().optional(),
  role: z.enum(["user", "admin"]).optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
  lastLoginAt: z
    .string()
    .datetime({ message: "La date de dernière connexion est invalide" })
    .nullable()
    .optional(),
});

/** Entrée de création d'une annonce. */
export const createAnnouncementInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Le titre est requis" })
    .max(120, { message: "Le titre ne doit pas dépasser 120 caractères" }),
  body: z
    .string()
    .trim()
    .min(1, { message: "Le contenu est requis" })
    .max(2000, { message: "Le contenu ne doit pas dépasser 2000 caractères" }),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  createdBy: uuidSchema.nullable().optional(),
});

/** Correctif partiel appliqué à une annonce existante. */
export const updateAnnouncementInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Le titre est requis" })
    .max(120, { message: "Le titre ne doit pas dépasser 120 caractères" })
    .optional(),
  body: z
    .string()
    .trim()
    .min(1, { message: "Le contenu est requis" })
    .max(2000, { message: "Le contenu ne doit pas dépasser 2000 caractères" })
    .optional(),
  isPinned: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

/** Entrée de création d'un signalement. */
export const createReportInputSchema = z.object({
  type: z.enum(["bug", "request"]),
  title: z
    .string()
    .trim()
    .min(1, { message: "Le titre est requis" })
    .max(120, { message: "Le titre ne doit pas dépasser 120 caractères" }),
  description: z
    .string()
    .trim()
    .min(1, { message: "La description est requise" })
    .max(4000, {
      message: "La description ne doit pas dépasser 4000 caractères",
    }),
  appId: uuidSchema.nullable().optional(),
  pageUrl: z
    .string()
    .trim()
    .max(500, { message: "L'URL de page ne doit pas dépasser 500 caractères" })
    .nullable()
    .optional(),
  createdBy: uuidSchema,
});

/** Changement du statut d'un signalement. */
export const updateReportStatusInputSchema = z.object({
  status: z.enum(["new", "in_progress", "resolved"]),
});

/** Changement de la priorité d'un signalement. */
export const updateReportPriorityInputSchema = z.object({
  priority: z.enum(["low", "normal", "high"]),
});

/** Assignation d'un signalement à un admin (ou retrait d'assignation). */
export const assignReportInputSchema = z.object({
  assignedTo: uuidSchema.nullable(),
});

/** Ajout d'un commentaire de suivi sur un signalement. */
export const addReportCommentInputSchema = z.object({
  comment: z
    .string()
    .trim()
    .min(1, { message: "Le commentaire est requis" })
    .max(2000, {
      message: "Le commentaire ne doit pas dépasser 2000 caractères",
    }),
});

/** Entrée d'écriture dans le journal d'activité. */
export const recordActivityLogInputSchema = z.object({
  actorId: uuidSchema.nullable().optional(),
  actorEmail: emailSchema.nullable().optional(),
  action: z
    .string()
    .trim()
    .max(80, { message: "L'action ne doit pas dépasser 80 caractères" })
    .regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/, {
      message: "L'action doit être au format « domaine.action » en minuscules",
    }),
  entityType: z.string().trim().nullable().optional(),
  entityId: z.string().trim().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
