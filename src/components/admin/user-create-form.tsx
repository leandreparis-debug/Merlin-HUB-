"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";

import { Field, SELECT_CLASS } from "@/components/admin/form-field";
import { ProvisionalPasswordPanel } from "@/components/admin/provisional-password-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUserAction } from "@/app/(app)/admin/users/actions";
import type { UserActionState } from "@/lib/admin/users/action-result";

interface Created {
  email: string;
  userId: string;
}

function CreateUserFormInner({
  loginUrl,
  onAcknowledge,
  onAnother,
}: {
  loginUrl: string;
  onAcknowledge: (created: Created) => void;
  onAnother: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    UserActionState,
    FormData
  >(createUserAction, null);
  const [role, setRole] = useState("user");
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  useEffect(() => {
    if (state && !state.ok) {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    }
  }, [state]);

  if (state?.ok && state.provisional) {
    const { email, password, userId } = state.provisional;
    return (
      <div className="space-y-4">
        <ProvisionalPasswordPanel
          email={email}
          password={password}
          loginUrl={loginUrl}
          onAcknowledge={() => onAcknowledge({ email, userId })}
        />
        <p className="flex flex-wrap gap-4 text-sm">
          <button
            type="button"
            onClick={onAnother}
            className="text-primary min-h-11 underline underline-offset-4"
          >
            Créer un autre utilisateur
          </button>
          <Link
            href={`/admin/users/${userId}`}
            className="text-primary inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Voir la fiche de l&apos;utilisateur
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        // Pas de `action` : évite la réinitialisation automatique du formulaire.
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
      className="max-w-xl space-y-5"
      noValidate
    >
      <div className="bg-muted text-foreground space-y-1 rounded-md px-4 py-3 text-sm">
        <p className="font-medium">Comment ça se passe</p>
        <ul className="list-disc pl-5">
          <li>Un mot de passe provisoire est généré par Merlin.</li>
          <li>
            Il est affiché une seule fois : transmettez-le à l&apos;utilisateur
            hors de l&apos;application.
          </li>
          <li>L&apos;utilisateur devra le changer à sa première connexion.</li>
        </ul>
      </div>

      {state && !state.ok ? (
        <div
          role="alert"
          className="border-destructive bg-status-offline-bg text-status-offline-text rounded-md border px-4 py-3 text-sm"
        >
          <p className="font-medium">{state.message}</p>
          {Object.keys(errors).length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {Object.values(errors).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <Field id="email" label="Email professionnel *" error={errors["email"]}>
        {(a11y) => (
          <Input
            {...a11y}
            name="email"
            type="email"
            autoComplete="off"
            required
            maxLength={254}
          />
        )}
      </Field>

      <Field
        id="fullName"
        label="Nom complet"
        hint="Facultatif, 80 caractères au plus."
        error={errors["fullName"]}
      >
        {(a11y) => (
          <Input {...a11y} name="fullName" autoComplete="off" maxLength={80} />
        )}
      </Field>

      <Field id="role" label="Rôle" error={errors["role"]}>
        {(a11y) => (
          <select
            {...a11y}
            name="role"
            className={SELECT_CLASS}
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="user">Utilisateur</option>
            <option value="admin">Admin</option>
          </select>
        )}
      </Field>
      {role === "admin" ? (
        <p
          data-testid="admin-role-warning"
          className="bg-status-maintenance-bg text-status-maintenance-text rounded-md px-4 py-3 text-sm font-medium"
        >
          Attention : un administrateur peut gérer les applications et tous les
          comptes (création, réinitialisation de mot de passe, désactivation).
          N&apos;attribuez ce rôle qu&apos;en cas de besoin.
        </p>
      ) : null}

      <Button type="submit" className="min-h-11" disabled={pending}>
        {pending ? "Création…" : "Créer le compte"}
      </Button>
    </form>
  );
}

/**
 * Création d'un compte : formulaire puis panneau de mot de passe provisoire
 * (sans redirection). Après « J'ai noté le mot de passe », l'état qui contenait
 * le mot de passe est détruit (le formulaire est démonté) et seule une
 * confirmation sans secret reste affichée.
 */
export function UserCreateForm({ loginUrl }: { loginUrl: string }) {
  const [instance, setInstance] = useState(0);
  const [done, setDone] = useState<Created | null>(null);

  if (done) {
    return (
      <div className="max-w-xl space-y-4" data-testid="user-created-done">
        <p
          role="status"
          className="bg-status-online-bg text-status-online-text rounded-md px-4 py-3 text-sm font-medium"
        >
          Le compte {done.email} a été créé. Le mot de passe provisoire
          n&apos;est plus affiché.
        </p>
        <p className="flex flex-wrap gap-4 text-sm">
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setInstance((value) => value + 1);
            }}
            className="text-primary min-h-11 underline underline-offset-4"
          >
            Créer un autre utilisateur
          </button>
          <Link
            href={`/admin/users/${done.userId}`}
            className="text-primary inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Voir la fiche de l&apos;utilisateur
          </Link>
        </p>
      </div>
    );
  }

  return (
    <CreateUserFormInner
      key={instance}
      loginUrl={loginUrl}
      onAcknowledge={(created) => {
        setDone(created);
        setInstance((value) => value + 1);
      }}
      onAnother={() => setInstance((value) => value + 1)}
    />
  );
}
