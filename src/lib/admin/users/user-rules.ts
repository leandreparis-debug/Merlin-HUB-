import type { Role } from "@/lib/data/types";

/** Résultat d'une règle : autorisé, ou refusé avec un message français exploitable par l'interface. */
export type RuleResult = { allowed: true } | { allowed: false; reason: string };

/** Contexte d'évaluation : acteur, cible (relue à jour) et nombre d'admins actifs (relu à jour). */
export interface UserRuleContext {
  actorId: string;
  target: { id: string; role: Role; isActive: boolean };
  activeAdminCount: number;
}

const ALLOWED: RuleResult = { allowed: true };

function isSelf(context: UserRuleContext): boolean {
  return context.actorId === context.target.id;
}

/** Vrai si la cible est un admin actif et le seul restant. */
function isLastActiveAdmin(context: UserRuleContext): boolean {
  return (
    context.target.role === "admin" &&
    context.target.isActive &&
    context.activeAdminCount <= 1
  );
}

/**
 * Changement de rôle vers `newRole`. Refusé pour soi-même (un admin ne se
 * rétrograde pas) et pour la rétrogradation du dernier admin actif. Une
 * promotion, ou un rôle inchangé, est toujours permis.
 */
export function canChangeRole(
  context: UserRuleContext,
  newRole: Role,
): RuleResult {
  if (newRole === context.target.role) return ALLOWED;
  if (newRole === "admin") return ALLOWED;
  if (isSelf(context)) {
    return {
      allowed: false,
      reason: "Vous ne pouvez pas modifier votre propre rôle.",
    };
  }
  if (isLastActiveAdmin(context)) {
    return {
      allowed: false,
      reason:
        "Impossible de rétrograder le dernier administrateur actif : nommez d'abord un autre administrateur.",
    };
  }
  return ALLOWED;
}

/**
 * Désactivation du compte. Refusée pour soi-même et pour le dernier admin
 * actif. Un compte déjà désactivé reste « désactivable » (sans effet).
 */
export function canDeactivate(context: UserRuleContext): RuleResult {
  if (isSelf(context)) {
    return {
      allowed: false,
      reason: "Vous ne pouvez pas désactiver votre propre compte.",
    };
  }
  if (isLastActiveAdmin(context)) {
    return {
      allowed: false,
      reason:
        "Impossible de désactiver le dernier administrateur actif : nommez d'abord un autre administrateur.",
    };
  }
  return ALLOWED;
}

/** Réactivation : toujours permise. */
export function canReactivate(): RuleResult {
  return ALLOWED;
}

/**
 * Réinitialisation du mot de passe. Refusée pour soi-même : un admin change
 * son mot de passe depuis « Changer mon mot de passe ».
 */
export function canResetPassword(context: UserRuleContext): RuleResult {
  if (isSelf(context)) {
    return {
      allowed: false,
      reason:
        "Vous ne pouvez pas réinitialiser votre propre mot de passe ici : utilisez « Changer mon mot de passe » dans le menu utilisateur.",
    };
  }
  return ALLOWED;
}
