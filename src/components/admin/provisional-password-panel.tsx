"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Texte prêt à envoyer à l'utilisateur (adresse du site, email, mot de passe provisoire, rappel). */
export function buildLoginInfo(params: {
  loginUrl: string;
  email: string;
  password: string;
}): string {
  return [
    "Votre accès à Merlin, le hub des outils Carrefour Property :",
    `Adresse : ${params.loginUrl}`,
    `Email : ${params.email}`,
    `Mot de passe provisoire : ${params.password}`,
    "Vous devrez choisir un nouveau mot de passe dès votre première connexion.",
  ].join("\n");
}

/**
 * Panneau d'affichage **unique** d'un mot de passe provisoire (création ou
 * réinitialisation). Le mot de passe n'existe que dans l'état de l'action : il
 * disparaît au rechargement ou quand l'admin clique sur « J'ai noté le mot de
 * passe ». Copie au presse-papiers avec retour `aria-live` ; si la copie est
 * impossible, le texte reste sélectionnable.
 */
export function ProvisionalPasswordPanel({
  email,
  password,
  loginUrl,
  title = "Compte créé",
  onAcknowledge,
}: {
  email: string;
  password: string;
  loginUrl: string;
  title?: string;
  onAcknowledge: () => void;
}) {
  const [feedback, setFeedback] = useState("");

  async function copy(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(success);
    } catch {
      setFeedback(
        "Copie impossible : sélectionnez le texte et copiez-le manuellement.",
      );
    }
  }

  return (
    <section
      aria-labelledby="provisional-title"
      data-testid="provisional-panel"
      className="border-primary bg-card space-y-4 rounded-lg border-2 p-5"
    >
      <h2
        id="provisional-title"
        className="text-foreground text-xl font-semibold"
      >
        {title}
      </h2>

      <p
        role="alert"
        className="bg-status-maintenance-bg text-status-maintenance-text rounded-md px-4 py-3 text-sm font-medium"
      >
        Ce mot de passe ne sera plus affiché. Transmettez-le à
        l&apos;utilisateur par un canal sûr, hors de Merlin.
      </p>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="font-medium break-all">{email}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mot de passe provisoire</dt>
          <dd>
            <code
              data-testid="provisional-password"
              className="bg-muted inline-block rounded-md px-3 py-2 font-mono text-base break-all select-all"
            >
              {password}
            </code>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Adresse de connexion</dt>
          <dd className="break-all">{loginUrl}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => copy(password, "Mot de passe copié.")}
        >
          Copier le mot de passe
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() =>
            copy(
              buildLoginInfo({ loginUrl, email, password }),
              "Informations de connexion copiées.",
            )
          }
        >
          Copier les informations de connexion
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm font-medium"
      >
        {feedback}
      </p>

      <Button type="button" className="min-h-11" onClick={onAcknowledge}>
        J&apos;ai noté le mot de passe
      </Button>
    </section>
  );
}
