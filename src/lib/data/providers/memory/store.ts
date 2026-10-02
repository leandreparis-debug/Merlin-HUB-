import type {
  ActivityLogEntry,
  Announcement,
  App,
  AppStatusEvent,
  Profile,
} from "@/lib/data/types";

/**
 * État en mémoire d'une instance de repositories. Une instance = un store
 * isolé (pas de partage entre deux appels à `createMemoryRepositories()`),
 * ce qui permet de l'utiliser librement dans les tests sans effet de bord
 * entre les suites.
 */
export class MemoryStore {
  readonly profiles = new Map<string, Profile>();
  readonly apps = new Map<string, App>();
  readonly announcements = new Map<string, Announcement>();
  appStatusEvents: AppStatusEvent[] = [];
  activityLog: ActivityLogEntry[] = [];

  /** Horodatage ISO 8601 courant (centralisé pour pouvoir être ajusté dans un test si besoin). */
  now(): string {
    return new Date().toISOString();
  }

  /** Génère un identifiant unique, au même format que `gen_random_uuid()`. */
  nextId(): string {
    return crypto.randomUUID();
  }
}

/** Données optionnelles pour pré-remplir un store à sa création (sans passer par la validation applicative). */
export interface MemoryStoreSeed {
  profiles?: Profile[];
  apps?: App[];
  announcements?: Announcement[];
}

/** Crée un store vide, optionnellement pré-rempli. */
export function createMemoryStore(seed?: MemoryStoreSeed): MemoryStore {
  const store = new MemoryStore();

  for (const profile of seed?.profiles ?? []) {
    store.profiles.set(profile.id, profile);
  }
  for (const app of seed?.apps ?? []) {
    store.apps.set(app.id, app);
  }
  for (const announcement of seed?.announcements ?? []) {
    store.announcements.set(announcement.id, announcement);
  }

  return store;
}
