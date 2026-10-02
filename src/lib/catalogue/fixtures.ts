import type { AppCardModel } from "@/lib/catalogue/view-model";

/** View model d'application pour les tests, surchargeable champ par champ. */
export function makeCard(overrides: Partial<AppCardModel> = {}): AppCardModel {
  return {
    id: overrides.id ?? overrides.name ?? "app",
    name: "Application",
    description: "",
    category: "Général",
    icon: "app-window",
    status: "online",
    statusMessage: null,
    updatedLabel: "",
    version: null,
    isNew: false,
    openUrl: "https://example.test/app",
    docUrl: null,
    ownerName: null,
    ownerEmail: null,
    ...overrides,
  };
}
