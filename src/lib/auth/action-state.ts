/** État d'un formulaire piloté par `useActionState` (message d'erreur ou de succès affiché dans une zone `aria-live`). */
export interface FormState {
  error?: string;
  /** Email saisi, renvoyé pour pré-remplir le champ après une erreur (jamais de mot de passe). */
  email?: string;
}
