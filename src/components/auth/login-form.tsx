"use client";

import { useActionState, useEffect, useRef } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/auth/action-state";
import { loginAction } from "@/lib/auth/actions";

/** Formulaire de connexion (email + mot de passe) ; l'erreur est annoncée dans une zone `role="alert"`. */
export function LoginForm({
  next,
  contactEmail,
}: {
  next: string;
  contactEmail?: string | undefined;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    loginAction,
    {},
  );
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.error) passwordRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={state.email ?? ""}
          required
        />
      </div>

      <PasswordField
        id="password"
        name="password"
        label="Mot de passe"
        autoComplete="current-password"
        ref={passwordRef}
        required
      />

      <div role="alert" aria-live="assertive">
        {state.error ? (
          <p className="text-destructive text-sm font-medium">{state.error}</p>
        ) : null}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        Mot de passe oublié ? Contactez l&apos;administrateur
        {contactEmail ? (
          <>
            {" "}
            :{" "}
            <a
              href={`mailto:${contactEmail}`}
              className="text-primary underline underline-offset-4"
            >
              {contactEmail}
            </a>
          </>
        ) : null}
        .
      </p>
    </form>
  );
}
