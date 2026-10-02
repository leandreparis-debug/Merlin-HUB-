"use client";

import { useActionState, useEffect, useRef } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/auth/action-state";
import { changePasswordAction } from "@/lib/auth/actions";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/lib/auth/password-policy";

/** Formulaire de changement de mot de passe (actuel, nouveau, confirmation) avec les règles affichées. */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    changePasswordAction,
    {},
  );
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.error) errorRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <PasswordField
        id="currentPassword"
        name="currentPassword"
        label="Mot de passe actuel"
        autoComplete="current-password"
        required
      />
      <PasswordField
        id="newPassword"
        name="newPassword"
        label="Nouveau mot de passe"
        autoComplete="new-password"
        hint={`Entre ${PASSWORD_MIN_LENGTH} et ${PASSWORD_MAX_LENGTH} caractères, différent de l'actuel, sans votre identifiant email. Aucune autre règle : une phrase longue convient très bien.`}
        required
      />
      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirmer le nouveau mot de passe"
        autoComplete="new-password"
        required
      />

      <div role="alert" aria-live="assertive" ref={errorRef} tabIndex={-1}>
        {state.error ? (
          <p className="text-destructive text-sm font-medium">{state.error}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enregistrement…" : "Changer mon mot de passe"}
      </Button>
    </form>
  );
}
