"use client";

import { startTransition, useActionState, type FormEvent } from "react";

import type { UserActionState } from "@/lib/admin/users/action-result";

/**
 * Branche une server action d'utilisateur sur un formulaire **sans** l'attribut
 * `action` (React réinitialiserait sinon le formulaire après chaque envoi, ce
 * qui désynchroniserait les listes déroulantes et cases à cocher de leur état).
 */
export function useUserAction(
  action: (
    previous: UserActionState,
    formData: FormData,
  ) => Promise<UserActionState>,
) {
  const [state, formAction, pending] = useActionState<
    UserActionState,
    FormData
  >(action, null);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }
  return { state, onSubmit, pending };
}
