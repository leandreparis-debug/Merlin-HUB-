import { NotImplementedError } from "@/lib/data/errors";

/**
 * Construit une fonction qui lève systématiquement {@link NotImplementedError}
 * avec le message donné. Utilisé pour les méthodes de repository dont
 * l'implémentation est prévue à une étape ultérieure (annonces, étape 7 ;
 * signalements, étape 8).
 */
export function notImplementedMethod<T extends (...args: never[]) => unknown>(
  message: string,
): T {
  return ((..._args: unknown[]) => {
    throw new NotImplementedError(message);
  }) as unknown as T;
}
