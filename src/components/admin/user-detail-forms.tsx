"use client";

import { useEffect, useState } from "react";

import { Field, SELECT_CLASS } from "@/components/admin/form-field";
import { ProvisionalPasswordPanel } from "@/components/admin/provisional-password-panel";
import { useUserAction } from "@/components/admin/use-user-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  changeUserRoleAction,
  resetUserPasswordAction,
  setUserActiveAction,
  updateUserAction,
} from "@/app/(app)/admin/users/actions";
import type { UserActionState } from "@/lib/admin/users/action-result";
import type { AdminUserDetail } from "@/lib/admin/users/view-models";

function Feedback({ state }: { state: UserActionState }) {
  if (!state) return null;
  return state.ok ? (
    <p role="status" className="text-sm font-medium">
      {state.message}
    </p>
  ) : (
    <p role="alert" className="text-destructive text-sm font-medium">
      {state.message}
    </p>
  );
}

function fieldErrors(state: UserActionState): Record<string, string> {
  return state && !state.ok ? (state.fieldErrors ?? {}) : {};
}

/** Explication affichée à la place d'un contrôle désactivé par une règle métier. */
function Explanation({ id, reason }: { id: string; reason: string }) {
  return (
    <p
      id={id}
      data-testid={id}
      className="bg-muted text-foreground rounded-md px-3 py-2 text-sm"
    >
      {reason}
    </p>
  );
}

/** Nom complet modifiable ; l'email est en lecture seule (identifiant, future clé SSO). */
export function UserInfoForm({ user }: { user: AdminUserDetail }) {
  const { state, onSubmit, pending } = useUserAction(updateUserAction);
  const errors = fieldErrors(state);
  const [fullName, setFullName] = useState(user.fullName);

  useEffect(() => {
    setFullName(user.fullName);
  }, [user.fullName]);

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4" noValidate>
      <input type="hidden" name="id" value={user.id} />
      <Field
        id="email"
        label="Email"
        hint="Pour changer d'adresse, créez un nouveau compte."
      >
        {(a11y) => <Input {...a11y} value={user.email} readOnly />}
      </Field>
      <Field
        id="fullName"
        label="Nom complet"
        hint="80 caractères au plus."
        error={errors["fullName"]}
      >
        {(a11y) => (
          <Input
            {...a11y}
            name="fullName"
            maxLength={80}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        )}
      </Field>
      <Feedback state={state} />
      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer le nom"}
      </Button>
    </form>
  );
}

/** Changement de rôle ; désactivé avec explication quand la règle l'interdit (soi-même, dernier admin actif). */
export function UserRoleForm({ user }: { user: AdminUserDetail }) {
  const { state, onSubmit, pending } = useUserAction(changeUserRoleAction);
  const errors = fieldErrors(state);
  const [role, setRole] = useState(user.role);
  const rule = user.permissions.changeRole;

  // Recharge la valeur depuis la base après une écriture.
  useEffect(() => {
    setRole(user.role);
  }, [user.role]);

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4" noValidate>
      <input type="hidden" name="id" value={user.id} />
      <Field id="user-role" label="Rôle" error={errors["role"]}>
        {(a11y) => (
          <select
            {...a11y}
            name="role"
            className={SELECT_CLASS}
            value={role}
            disabled={!rule.allowed}
            aria-describedby={
              [a11y["aria-describedby"], rule.allowed ? "" : "role-rule"]
                .filter(Boolean)
                .join(" ") || undefined
            }
            onChange={(event) => setRole(event.target.value as typeof role)}
          >
            <option value="user">Utilisateur</option>
            <option value="admin">Admin</option>
          </select>
        )}
      </Field>
      {rule.allowed ? null : (
        <Explanation id="role-rule" reason={rule.reason} />
      )}
      <Feedback state={state} />
      <Button
        type="submit"
        className="min-h-11"
        disabled={pending || !rule.allowed}
      >
        {pending ? "Enregistrement…" : "Changer le rôle"}
      </Button>
    </form>
  );
}

/** Désactivation / réactivation avec confirmation (case à cocher) ; règles affichées quand elles interdisent. */
export function UserAccessForm({ user }: { user: AdminUserDetail }) {
  const { state, onSubmit, pending } = useUserAction(setUserActiveAction);
  const [confirmed, setConfirmed] = useState(false);
  const rule = user.permissions.deactivate;

  // Une nouvelle confirmation est exigée après chaque changement d'état.
  useEffect(() => {
    setConfirmed(false);
  }, [user.isActive]);

  if (!user.isActive) {
    return (
      <form onSubmit={onSubmit} className="max-w-xl space-y-4" noValidate>
        <input type="hidden" name="id" value={user.id} />
        <input type="hidden" name="active" value="true" />
        <p className="text-sm">
          Ce compte est désactivé : son titulaire ne peut plus se connecter.
          L&apos;historique et le journal d&apos;activité sont conservés.
        </p>
        <Feedback state={state} />
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? "Réactivation…" : "Réactiver le compte"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4" noValidate>
      <input type="hidden" name="id" value={user.id} />
      <input type="hidden" name="active" value="false" />
      <p className="text-sm">
        La désactivation bloque l&apos;accès immédiatement, même pour une
        session déjà ouverte, et conserve l&apos;historique et le journal
        d&apos;activité. Le compte peut être réactivé à tout moment.
      </p>
      {rule.allowed ? null : (
        <Explanation id="deactivate-rule" reason={rule.reason} />
      )}
      <div className="flex min-h-11 items-center gap-3">
        <input
          id="confirm-deactivate"
          type="checkbox"
          checked={confirmed}
          disabled={!rule.allowed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="accent-primary size-5"
        />
        <label htmlFor="confirm-deactivate" className="text-sm font-medium">
          Je confirme la désactivation de ce compte
        </label>
      </div>
      <Feedback state={state} />
      <Button
        type="submit"
        variant="destructive"
        className="min-h-11"
        disabled={pending || !rule.allowed || !confirmed}
      >
        {pending ? "Désactivation…" : "Désactiver le compte"}
      </Button>
    </form>
  );
}

function ResetPasswordInner({
  user,
  loginUrl,
  onAcknowledge,
}: {
  user: AdminUserDetail;
  loginUrl: string;
  onAcknowledge: () => void;
}) {
  const { state, onSubmit, pending } = useUserAction(resetUserPasswordAction);
  const [confirmed, setConfirmed] = useState(false);
  const rule = user.permissions.resetPassword;

  if (state?.ok && state.provisional) {
    return (
      <ProvisionalPasswordPanel
        email={state.provisional.email}
        password={state.provisional.password}
        loginUrl={loginUrl}
        title="Mot de passe réinitialisé"
        onAcknowledge={onAcknowledge}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-4" noValidate>
      <input type="hidden" name="id" value={user.id} />
      <p className="text-sm">
        L&apos;ancien mot de passe cessera de fonctionner. Un nouveau mot de
        passe provisoire sera généré et affiché <strong>une seule fois</strong>;
        l&apos;utilisateur devra le changer à sa prochaine connexion.
      </p>
      {rule.allowed ? null : (
        <Explanation id="reset-rule" reason={rule.reason} />
      )}
      <div className="flex min-h-11 items-center gap-3">
        <input
          id="confirm-reset"
          type="checkbox"
          checked={confirmed}
          disabled={!rule.allowed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="accent-primary size-5"
        />
        <label htmlFor="confirm-reset" className="text-sm font-medium">
          Je confirme la réinitialisation du mot de passe
        </label>
      </div>
      <Feedback state={state} />
      <Button
        type="submit"
        variant="destructive"
        className="min-h-11"
        disabled={pending || !rule.allowed || !confirmed}
      >
        {pending ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
      </Button>
    </form>
  );
}

/**
 * Réinitialisation du mot de passe avec confirmation. Au succès, le panneau de
 * mot de passe provisoire (affiché une seule fois) remplace le formulaire ;
 * « J'ai noté le mot de passe » démonte l'état qui le contenait.
 */
export function UserPasswordForm({
  user,
  loginUrl,
}: {
  user: AdminUserDetail;
  loginUrl: string;
}) {
  const [instance, setInstance] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);

  if (acknowledged) {
    return (
      <div className="max-w-xl space-y-3">
        <p role="status" className="text-sm font-medium">
          Le mot de passe a été réinitialisé ; il n&apos;est plus affiché.
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => {
            setAcknowledged(false);
            setInstance((value) => value + 1);
          }}
        >
          Réinitialiser à nouveau
        </Button>
      </div>
    );
  }

  return (
    <ResetPasswordInner
      key={instance}
      user={user}
      loginUrl={loginUrl}
      onAcknowledge={() => {
        setAcknowledged(true);
        setInstance((value) => value + 1);
      }}
    />
  );
}
