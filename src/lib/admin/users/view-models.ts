import {
  formatAbsoluteParis,
  formatRelativeTime,
} from "@/lib/catalogue/status";
import {
  canChangeRole,
  canDeactivate,
  canResetPassword,
  type RuleResult,
} from "@/lib/admin/users/user-rules";
import type { ActivityLogEntry, Profile, Role } from "@/lib/data/types";

/** Libellé de la dernière connexion quand elle n'a jamais eu lieu. */
export const NEVER_LOGGED_IN_LABEL = "Jamais connecté";

/** Ligne de la liste des utilisateurs (objet simple, sérialisable). */
export interface AdminUserRow {
  id: string;
  fullName: string | null;
  email: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  /** Date relative calculée côté serveur, ou « Jamais connecté ». */
  lastLoginLabel: string;
  isSelf: boolean;
}

/** Entrée d'activité lisible (journal d'activité). */
export interface ActivityRow {
  id: string;
  label: string;
  absoluteDate: string;
  relativeDate: string;
}

/** Fiche d'un utilisateur : valeurs affichées et autorisations déjà évaluées côté serveur. */
export interface AdminUserDetail {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  isSelf: boolean;
  createdAbsolute: string;
  lastLoginAbsolute: string;
  lastLoginLabel: string;
  /** Change à chaque écriture : clé de rechargement des formulaires. */
  updatedAt: string;
  /** Règles évaluées pour l'interface (les actions les revérifient côté serveur). */
  permissions: {
    changeRole: RuleResult;
    deactivate: RuleResult;
    resetPassword: RuleResult;
  };
}

/** Synthèse des comptes pour le tableau de bord. */
export interface UserSummary {
  total: number;
  active: number;
  activeAdmins: number;
  pendingFirstLogin: number;
}

/** Ordre de la liste : nom (les comptes sans nom en dernier), puis email. */
export function sortProfiles<T extends Pick<Profile, "fullName" | "email">>(
  profiles: readonly T[],
): T[] {
  return [...profiles].sort((a, b) => {
    const nameA = a.fullName?.trim() ?? "";
    const nameB = b.fullName?.trim() ?? "";
    if (nameA && !nameB) return -1;
    if (!nameA && nameB) return 1;
    return (
      nameA.localeCompare(nameB, "fr") || a.email.localeCompare(b.email, "fr")
    );
  });
}

function lastLogin(profile: Profile, now: Date): string {
  if (!profile.lastLoginAt) return NEVER_LOGGED_IN_LABEL;
  return formatRelativeTime(profile.lastLoginAt, now);
}

/** Lignes de la liste des utilisateurs (actifs et désactivés). */
export function toAdminUserRows(
  profiles: readonly Profile[],
  actorId: string,
  now: Date,
): AdminUserRow[] {
  return sortProfiles(profiles).map((profile) => ({
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    role: profile.role,
    isActive: profile.isActive,
    mustChangePassword: profile.mustChangePassword,
    lastLoginLabel: lastLogin(profile, now),
    isSelf: profile.id === actorId,
  }));
}

/** Fiche d'un utilisateur avec ses autorisations (règles de `user-rules`). */
export function toAdminUserDetail(
  profile: Profile,
  actorId: string,
  activeAdminCount: number,
  now: Date,
): AdminUserDetail {
  const context = {
    actorId,
    target: { id: profile.id, role: profile.role, isActive: profile.isActive },
    activeAdminCount,
  };
  // Le sélecteur de rôle propose « l'autre » rôle : on évalue ce changement.
  const otherRole: Role = profile.role === "admin" ? "user" : "admin";
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.fullName ?? "",
    role: profile.role,
    isActive: profile.isActive,
    mustChangePassword: profile.mustChangePassword,
    isSelf: profile.id === actorId,
    createdAbsolute: formatAbsoluteParis(profile.createdAt),
    lastLoginAbsolute: profile.lastLoginAt
      ? formatAbsoluteParis(profile.lastLoginAt)
      : "",
    lastLoginLabel: lastLogin(profile, now),
    updatedAt: profile.updatedAt,
    permissions: {
      changeRole: canChangeRole(context, otherRole),
      deactivate: canDeactivate(context),
      resetPassword: canResetPassword(context),
    },
  };
}

/** Compteurs du tableau de bord. */
export function summarizeUsers(profiles: readonly Profile[]): UserSummary {
  let active = 0;
  let activeAdmins = 0;
  let pendingFirstLogin = 0;
  for (const profile of profiles) {
    if (profile.isActive) {
      active += 1;
      if (profile.role === "admin") activeAdmins += 1;
    }
    if (profile.mustChangePassword && profile.isActive) pendingFirstLogin += 1;
  }
  return { total: profiles.length, active, activeAdmins, pendingFirstLogin };
}

/** Libellés français des actions du journal d'activité. */
const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Connexion",
  "auth.login_failed": "Échec de connexion",
  "auth.logout": "Déconnexion",
  "auth.password_changed": "Mot de passe modifié",
  "auth.view_mode_changed": "Changement de vue (admin / utilisateur)",
  "app.created": "Application créée",
  "app.updated": "Application modifiée",
  "app.deleted": "Application supprimée",
  "app.hidden": "Application masquée",
  "app.shown": "Application affichée",
  "app.moved": "Application déplacée",
  "app.status_changed": "Statut d'application modifié",
  "user.created": "Compte utilisateur créé",
  "user.updated": "Compte utilisateur modifié",
  "user.role_changed": "Rôle d'un utilisateur modifié",
  "user.deactivated": "Compte utilisateur désactivé",
  "user.reactivated": "Compte utilisateur réactivé",
  "user.password_reset": "Mot de passe d'un utilisateur réinitialisé",
};

/** Libellé français d'une action du journal (l'action brute à défaut). */
export function activityLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Entrées d'activité lisibles (dates absolue Europe/Paris et relative, calculées côté serveur). */
export function toActivityRows(
  entries: readonly ActivityLogEntry[],
  now: Date,
): ActivityRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    label: activityLabel(entry.action),
    absoluteDate: formatAbsoluteParis(entry.createdAt),
    relativeDate: formatRelativeTime(entry.createdAt, now),
  }));
}
