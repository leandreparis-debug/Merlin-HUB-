import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createAppAction: vi.fn(),
  updateAppAction: vi.fn(),
  setAppStatusAction: vi.fn(),
  deleteAppAction: vi.fn(),
  moveAppAction: vi.fn(),
  setAppVisibilityAction: vi.fn(),
}));
vi.mock("@/app/(app)/admin/apps/actions", () => actions);

const { AppForm } = await import("@/components/admin/app-form");
const { AppsTable } = await import("@/components/admin/apps-table");
const { StatusPanel } = await import("@/components/admin/status-panel");
const { DeleteZone } = await import("@/components/admin/delete-zone");
const { EMPTY_APP_FORM } = await import("@/lib/admin/apps/form");

import type { AdminAppRow } from "@/lib/admin/apps/view-models";

beforeEach(() => {
  vi.clearAllMocks();
});

function submit(label: RegExp | string) {
  const form = screen.getByRole("button", { name: label }).closest("form");
  if (!form) throw new Error("formulaire introuvable");
  return act(async () => {
    fireEvent.submit(form);
  });
}

describe("AppForm", () => {
  const props = {
    categories: ["Entrepôts", "Référentiel"],
    updatedLabel: "mis à jour à l'instant",
  };

  it("affiche les erreurs par champ avec aria-describedby, aria-invalid et un résumé role=alert", async () => {
    actions.createAppAction.mockResolvedValueOnce({
      ok: false,
      message: "Le formulaire contient des erreurs.",
      fieldErrors: { name: "Le nom est requis", url: "URL invalide" },
    });
    render(<AppForm mode="create" initial={EMPTY_APP_FORM} {...props} />);

    await submit("Créer l'application");

    const name = screen.getByLabelText("Nom *");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name.getAttribute("aria-describedby")).toContain("name-error");
    expect(document.getElementById("name-error")).toHaveTextContent(
      "Le nom est requis",
    );
    const url = screen.getByLabelText("URL de l'application");
    expect(url.getAttribute("aria-describedby")).toContain("url-error");
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Le formulaire contient des erreurs.");
    expect(alert).toHaveTextContent("URL invalide");
    await waitFor(() => expect(name).toHaveFocus());
  });

  it("génère le slug depuis le nom à la création, jusqu'à ce qu'il soit modifié à la main", () => {
    render(<AppForm mode="create" initial={EMPTY_APP_FORM} {...props} />);
    const name = screen.getByLabelText("Nom *");
    const slug = screen.getByLabelText(/Slug/);

    fireEvent.change(name, { target: { value: "Outil entrepôts" } });
    expect(slug).toHaveValue("outil-entrepots");

    fireEvent.change(slug, { target: { value: "mon-slug" } });
    fireEvent.change(name, { target: { value: "Autre nom" } });
    expect(slug).toHaveValue("mon-slug");
    expect(
      screen.getByText(/Il ne pourra plus être modifié après la création/),
    ).toBeInTheDocument();
  });

  it("rend le slug en lecture seule, hors formulaire, à la modification", () => {
    render(
      <AppForm
        mode="edit"
        appId="id-1"
        initial={{ ...EMPTY_APP_FORM, name: "Outil", slug: "outil" }}
        statusPreview={{ status: "online", statusNote: "" }}
        {...props}
      />,
    );
    const slug = screen.getByLabelText(/Slug/);
    expect(slug).toHaveAttribute("readonly");
    expect(slug).not.toHaveAttribute("name");
    expect(screen.queryByLabelText("Statut initial")).not.toBeInTheDocument();
    expect(screen.getByText(/ne peut pas être modifié/)).toBeInTheDocument();
  });

  it("met l'aperçu à jour en direct et désactive les liens de l'aperçu", () => {
    render(<AppForm mode="create" initial={EMPTY_APP_FORM} {...props} />);
    const preview = within(screen.getByTestId("app-preview"));
    expect(
      preview.getByRole("button", { name: "Bientôt disponible" }),
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nom *"), {
      target: { value: "Outil test" },
    });
    fireEvent.change(screen.getByLabelText("URL de l'application"), {
      target: { value: "https://example.test/x" },
    });
    fireEvent.click(screen.getByLabelText("Afficher le badge « Nouveau »"));

    expect(
      preview.getByRole("heading", { name: "Outil test" }),
    ).toBeInTheDocument();
    expect(preview.getByText("Nouveau")).toBeInTheDocument();
    expect(preview.getByRole("link", { name: /^Ouvrir/ })).toBeInTheDocument();
    expect(screen.getByTestId("app-preview")).toHaveAttribute("inert");

    fireEvent.change(screen.getByLabelText("URL de l'application"), {
      target: { value: "javascript:alert(1)" },
    });
    expect(
      preview.queryByRole("link", { name: /^Ouvrir/ }),
    ).not.toBeInTheDocument();
  });

  it("propose un sélecteur d'icône en boutons radio focalisables qui met l'aperçu à jour", () => {
    render(<AppForm mode="create" initial={EMPTY_APP_FORM} {...props} />);
    const group = screen.getByRole("radiogroup", {
      name: "Icône de l'application",
    });
    const radios = within(group).getAllByRole("radio");
    expect(radios.length).toBeGreaterThanOrEqual(40);
    expect(radios.every((radio) => !radio.hasAttribute("disabled"))).toBe(true);

    const warehouse = within(group).getByRole("radio", { name: "warehouse" });
    warehouse.focus();
    expect(warehouse).toHaveFocus();
    fireEvent.click(warehouse);
    expect(warehouse).toBeChecked();
    expect(
      screen.getByText("Icône sélectionnée : warehouse"),
    ).toBeInTheDocument();
  });

  it("suggère les catégories existantes via un datalist", () => {
    const { container } = render(
      <AppForm mode="create" initial={EMPTY_APP_FORM} {...props} />,
    );
    const options = container.querySelectorAll("#category-suggestions option");
    expect([...options].map((option) => option.getAttribute("value"))).toEqual([
      "Entrepôts",
      "Référentiel",
    ]);
  });
});

describe("AppsTable", () => {
  const rows: AdminAppRow[] = [
    {
      id: "a",
      name: "Alpha",
      icon: "warehouse",
      category: "Entrepôts",
      status: "online",
      isHidden: false,
      version: "1.0.0",
      isNew: true,
      hasUrl: true,
      statusUpdatedLabel: "il y a 2 h",
      canMoveUp: false,
      canMoveDown: true,
    },
    {
      id: "b",
      name: "Bravo",
      icon: "map-pin",
      category: "Référentiel",
      status: "maintenance",
      isHidden: true,
      version: null,
      isNew: false,
      hasUrl: false,
      statusUpdatedLabel: "hier",
      canMoveUp: true,
      canMoveDown: false,
    },
  ];

  it("étiquette les apps masquées et indique le statut en texte", () => {
    render(<AppsTable rows={rows} />);
    const bravo = screen.getAllByTestId("admin-app-row")[1]!;
    expect(within(bravo).getByText("Masquée")).toBeInTheDocument();
    expect(within(bravo).getByText("Maintenance")).toBeInTheDocument();
    expect(within(bravo).getByText("Bientôt disponible")).toBeInTheDocument();
    expect(
      within(screen.getAllByTestId("admin-app-row")[0]!).queryByText("Masquée"),
    ).toBeNull();
  });

  it("désactive monter/descendre aux extrémités, avec un aria-label incluant le nom", () => {
    render(<AppsTable rows={rows} />);
    expect(screen.getByRole("button", { name: "Monter Alpha" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Descendre Alpha" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Monter Bravo" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Descendre Bravo" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Masquer Alpha" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Afficher Bravo" }),
    ).toBeInTheDocument();
  });

  it("n'envoie au serveur que l'id et la direction, puis annonce le résultat (aria-live)", async () => {
    actions.moveAppAction.mockResolvedValueOnce({
      ok: true,
      message: "« Alpha » a été descendue.",
    });
    render(<AppsTable rows={rows} />);

    fireEvent.click(screen.getByRole("button", { name: "Descendre Alpha" }));

    await waitFor(() =>
      expect(screen.getByTestId("admin-apps-message")).toHaveTextContent(
        "« Alpha » a été descendue.",
      ),
    );
    expect(actions.moveAppAction).toHaveBeenCalledWith("a", "down");
    expect(screen.getByTestId("admin-apps-message")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("masque / affiche via une action", async () => {
    actions.setAppVisibilityAction.mockResolvedValue({
      ok: true,
      message: "ok",
    });
    render(<AppsTable rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Masquer Alpha" }));
    await waitFor(() =>
      expect(actions.setAppVisibilityAction).toHaveBeenCalledWith("a", true),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Afficher Bravo" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Afficher Bravo" }));
    await waitFor(() =>
      expect(actions.setAppVisibilityAction).toHaveBeenCalledWith("b", false),
    );
  });

  it("affiche l'état vide", () => {
    render(<AppsTable rows={[]} />);
    expect(
      screen.getByText("Aucune application. Ajoutez la première."),
    ).toBeInTheDocument();
  });
});

describe("StatusPanel", () => {
  const props = {
    appId: "a",
    status: "online" as const,
    message: "",
    updatedAbsolute: "15 juin 2026, 12:00",
    updatedRelative: "il y a 2 h",
  };

  it("indique « Statut inchangé » quand le statut choisi est l'actuel", () => {
    render(<StatusPanel {...props} />);
    expect(screen.getByTestId("status-unchanged")).toHaveTextContent(
      "Statut inchangé : seul le message sera mis à jour.",
    );

    fireEvent.change(screen.getByLabelText("Nouveau statut"), {
      target: { value: "maintenance" },
    });
    expect(screen.queryByTestId("status-unchanged")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nouveau statut"), {
      target: { value: "online" },
    });
    expect(screen.getByTestId("status-unchanged")).toBeInTheDocument();
  });

  it("affiche le statut actuel (texte) et la date de dernière mise à jour", () => {
    render(<StatusPanel {...props} />);
    expect(document.querySelector('[data-status="online"]')).toHaveTextContent(
      "En ligne",
    );
    expect(screen.getByText(/15 juin 2026, 12:00/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mettre à jour le statut" }),
    ).toBeEnabled();
  });

  it("conserve le statut choisi après l'envoi (pas de réinitialisation du formulaire)", async () => {
    actions.setAppStatusAction.mockResolvedValueOnce({
      ok: true,
      message: "Statut mis à jour : En ligne → Maintenance.",
    });
    render(<StatusPanel {...props} />);
    fireEvent.change(screen.getByLabelText("Nouveau statut"), {
      target: { value: "maintenance" },
    });
    await submit("Mettre à jour le statut");
    expect(screen.getByLabelText("Nouveau statut")).toHaveValue("maintenance");
    expect(actions.setAppStatusAction).toHaveBeenCalledTimes(1);
    const sent = actions.setAppStatusAction.mock.calls[0]?.[1] as FormData;
    expect(sent.get("status")).toBe("maintenance");
    expect(sent.get("id")).toBe("a");
  });

  it("affiche l'erreur de note trop longue sur le champ", async () => {
    actions.setAppStatusAction.mockResolvedValueOnce({
      ok: false,
      message: "Le formulaire contient des erreurs.",
      fieldErrors: {
        statusNote: "La note ne doit pas dépasser 300 caractères",
      },
    });
    render(<StatusPanel {...props} />);
    await submit("Mettre à jour le statut");
    const note = screen.getByLabelText("Note (facultative)");
    expect(note).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("statusNote-error")).toHaveTextContent(
      "300",
    );
  });
});

describe("DeleteZone", () => {
  it("désactive le bouton tant que le nom saisi ne correspond pas exactement", () => {
    render(<DeleteZone appId="a" appName="Outil entrepôts" />);
    const button = screen.getByRole("button", {
      name: "Supprimer définitivement",
    });
    const input = screen.getByLabelText(/Saisissez le nom exact/);

    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "outil entrepots" } });
    expect(button).toBeDisabled();
    fireEvent.change(input, { target: { value: "Outil entrepôts" } });
    expect(button).toBeEnabled();
    fireEvent.change(input, { target: { value: "Outil entrepôts 2" } });
    expect(button).toBeDisabled();
  });

  it("rappelle que l'action est irréversible et supprime le journal", () => {
    render(<DeleteZone appId="a" appName="Outil" />);
    expect(screen.getByText(/irréversible/)).toBeInTheDocument();
    expect(
      screen.getByText(/journal des changements de statut/),
    ).toBeInTheDocument();
    expect(screen.getByText("Supprimer cette application")).toBeInTheDocument();
  });
});
