import "server-only";

import type { MemoryAuthService } from "@/lib/auth/providers/memory";

/**
 * Comptes de développement de l'authentification mémoire. **Valeurs
 * factices**, jamais utilisables hors dev (l'auth mémoire est interdite en
 * production, et le seed n'est appliqué que si `NODE_ENV !== "production"`).
 */
export const DEV_ACCOUNTS = {
  admin: {
    email: "admin@example.test",
    password: "Admin-Password-123",
    fullName: "Alex Admin",
    role: "admin",
  },
  user: {
    email: "user@example.test",
    password: "User-Password-123",
    fullName: "Camille Utilisateur",
    role: "user",
  },
  nouveau: {
    email: "nouveau@example.test",
    password: "Temp-Password-1234",
    fullName: "Nina Nouvelle",
    role: "user",
    mustChangePassword: true,
  },
  desactive: {
    email: "desactive@example.test",
    password: "Disabled-Pass-123",
    fullName: "Denis Désactivé",
    role: "user",
    isActive: false,
  },
} as const;

/** Crée les comptes de développement ; sans effet en production. */
export async function seedDevAccounts(
  service: MemoryAuthService,
): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  for (const account of Object.values(DEV_ACCOUNTS)) {
    await service.addAccount(account);
  }
}
