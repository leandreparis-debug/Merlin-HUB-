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
  createAnnouncementAction: vi.fn(),
  updateAnnouncementAction: vi.fn(),
  setAnnouncementPinnedAction: vi.fn(),
  setAnnouncementPublishedAction: vi.fn(),
  deleteAnnouncementAction: vi.fn(),
}));
vi.mock("@/app/(app)/admin/announcements/actions", () => actions);

const { AnnouncementForm } =
  await import("@/components/admin/announcement-form");
const { AnnouncementsTable } =
  await import("@/components/admin/announcements-table");
const { AnnouncementDeleteZone } =
  await import("@/components/admin/announcement-delete-zone");
const { AnnouncementStatePanel } =
  await import("@/components/admin/announcement-state-panel");
const { EMPTY_ANNOUNCEMENT_FORM } =
  await import("@/lib/admin/announcements/form");

import type { AdminAnnouncementRow } from "@/lib/admin/announcements/view-models";

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

describe("AnnouncementForm", () => {
  const props = { pinnedCount: 0, previewLabel: "publiée à l'instant" };

  it("affiche le compteur de caractères restants", () => {
    render(
      <AnnouncementForm
        mode="create"
        initial={EMPTY_ANNOUNCEMENT_FORM}
        {...props}
      />,
    );
    expect(screen.getByTestId("text-counter")).toHaveTextContent(
      "2000 caractères restants sur 2000",
    );

    fireEvent.change(screen.getByLabelText("Texte *"), {
      target: { value: "Bonjour" },
    });
    expect(screen.getByTestId("text-counter")).toHaveTextContent(
      "1993 caractères restants sur 2000",
    );
  });

  it("met à jour l'aperçu en direct, texte brut littéral", () => {
    render(
      <AnnouncementForm
        mode="create"
        initial={EMPTY_ANNOUNCEMENT_FORM}
        {...props}
      />,
    );
    fireEvent.change(screen.getByLabelText("Titre *"), {
      target: { value: "Mon titre" },
    });
    fireEvent.change(screen.getByLabelText("Texte *"), {
      target: { value: "<b>gras</b>" },
    });

    const preview = within(screen.getByTestId("announcement-preview"));
    expect(
      preview.getByRole("heading", { level: 3, name: "Mon titre" }),
    ).toBeInTheDocument();
    expect(preview.getByText("<b>gras</b>")).toBeInTheDocument();
    expect(preview.queryByText("Épinglée")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Épingler"));
    expect(preview.getByText("Épinglée")).toBeInTheDocument();
  });

  it("« Publier immédiatement » est coché par défaut, « Épingler » non", () => {
    render(
      <AnnouncementForm
        mode="create"
        initial={EMPTY_ANNOUNCEMENT_FORM}
        {...props}
      />,
    );
    expect(screen.getByLabelText("Publier immédiatement")).toBeChecked();
    expect(screen.getByLabelText("Épingler")).not.toBeChecked();
  });

  it("avertit, sans bloquer, quand 3 annonces sont déjà épinglées", () => {
    render(
      <AnnouncementForm
        mode="create"
        initial={EMPTY_ANNOUNCEMENT_FORM}
        pinnedCount={3}
        previewLabel="x"
      />,
    );
    expect(screen.queryByTestId("pin-warning")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Épingler"));
    expect(screen.getByTestId("pin-warning")).toHaveTextContent(
      "3 annonces sont déjà épinglées",
    );
    expect(
      screen.getByRole("button", { name: "Créer l'annonce" }),
    ).toBeEnabled();
  });

  it("affiche les erreurs par champ avec aria-describedby, aria-invalid, role=alert et focus", async () => {
    actions.createAnnouncementAction.mockResolvedValueOnce({
      ok: false,
      message: "Le formulaire contient des erreurs.",
      fieldErrors: {
        title: "Le titre est requis",
        text: "Le texte est requis",
      },
    });
    render(
      <AnnouncementForm
        mode="create"
        initial={EMPTY_ANNOUNCEMENT_FORM}
        {...props}
      />,
    );

    await submit("Créer l'annonce");

    const title = screen.getByLabelText("Titre *");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title.getAttribute("aria-describedby")).toContain("title-error");
    expect(document.getElementById("title-error")).toHaveTextContent(
      "Le titre est requis",
    );
    expect(
      screen.getByLabelText("Texte *").getAttribute("aria-describedby"),
    ).toContain("text-error");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Le formulaire contient des erreurs.",
    );
    await waitFor(() => expect(title).toHaveFocus());
  });

  it("désactive le bouton pendant l'envoi", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    actions.createAnnouncementAction.mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(
      <AnnouncementForm
        mode="create"
        initial={EMPTY_ANNOUNCEMENT_FORM}
        {...props}
      />,
    );

    await submit("Créer l'annonce");
    expect(
      screen.getByRole("button", { name: "Enregistrement…" }),
    ).toBeDisabled();

    await act(async () => resolve({ ok: true, message: "ok" }));
  });

  it("en édition : pas de cases d'état, champ caché id, retour annoncé en role=status", async () => {
    actions.updateAnnouncementAction.mockResolvedValueOnce({
      ok: true,
      message: "L'annonce a été enregistrée.",
    });
    const { container } = render(
      <AnnouncementForm
        mode="edit"
        announcementId="abc"
        initial={{
          title: "Titre",
          text: "Texte",
          isPinned: false,
          isPublished: true,
        }}
        {...props}
      />,
    );
    expect(screen.queryByLabelText("Épingler")).not.toBeInTheDocument();
    expect(container.querySelector('input[name="id"]')).toHaveValue("abc");

    await submit("Enregistrer les modifications");

    expect(
      await screen.findByText("L'annonce a été enregistrée."),
    ).toHaveAttribute("aria-live", "polite");
  });
});

describe("AnnouncementsTable", () => {
  const rows: AdminAnnouncementRow[] = [
    {
      id: "1",
      title: "Épinglée publiée",
      excerpt: "Extrait 1",
      isPublished: true,
      isPinned: true,
      dateLabel: "publiée il y a 2 h",
    },
    {
      id: "2",
      title: "Brouillon test",
      excerpt: "Extrait 2",
      isPublished: false,
      isPinned: false,
      dateLabel: "jamais publiée",
    },
  ];

  it("affiche l'état en texte (Publiée / Brouillon / Épinglée) et la date", () => {
    render(<AnnouncementsTable rows={rows} pinnedCount={1} />);

    const [first, second] = screen.getAllByTestId("admin-announcement-row");
    expect(
      within(first as HTMLElement).getByText("Publiée"),
    ).toBeInTheDocument();
    expect(
      within(first as HTMLElement).getByText("Épinglée"),
    ).toBeInTheDocument();
    expect(
      within(second as HTMLElement).getByText("Brouillon"),
    ).toBeInTheDocument();
    expect(
      within(second as HTMLElement).queryByText("Épinglée"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("jamais publiée")).toBeInTheDocument();
  });

  it("les boutons rapides ont un aria-label contenant le titre", () => {
    render(<AnnouncementsTable rows={rows} pinnedCount={1} />);

    expect(
      screen.getByRole("button", { name: "Désépingler Épinglée publiée" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dépublier Épinglée publiée" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publier Brouillon test" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Épingler Brouillon test" }),
    ).toBeInTheDocument();
  });

  it("envoie des valeurs explicites (pas de bascule) et annonce le retour en aria-live", async () => {
    actions.setAnnouncementPublishedAction.mockResolvedValueOnce({
      ok: true,
      message: "« Brouillon test » est publiée.",
    });
    render(<AnnouncementsTable rows={rows} pinnedCount={1} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Publier Brouillon test" }),
    );

    await waitFor(() =>
      expect(actions.setAnnouncementPublishedAction).toHaveBeenCalledWith(
        "2",
        true,
      ),
    );
    expect(
      await screen.findByText("« Brouillon test » est publiée."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("admin-announcements-message")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("épingler envoie la valeur cible et signale l'avertissement au-delà de 3", async () => {
    actions.setAnnouncementPinnedAction.mockResolvedValueOnce({
      ok: true,
      message: "ok",
    });
    render(<AnnouncementsTable rows={rows} pinnedCount={3} />);

    const pin = screen.getByRole("button", { name: "Épingler Brouillon test" });
    expect(pin).toHaveAttribute(
      "title",
      expect.stringContaining("3 s'affichent"),
    );
    fireEvent.click(pin);

    await waitFor(() =>
      expect(actions.setAnnouncementPinnedAction).toHaveBeenCalledWith(
        "2",
        true,
      ),
    );
  });

  it("filtre par titre, sans accents ni casse", () => {
    render(<AnnouncementsTable rows={rows} pinnedCount={1} />);

    fireEvent.change(screen.getByLabelText("Rechercher par titre"), {
      target: { value: "EPINGLEE" },
    });

    expect(screen.getAllByTestId("admin-announcement-row")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("Rechercher par titre"), {
      target: { value: "introuvable" },
    });
    expect(
      screen.getByText("Aucune annonce ne correspond à cette recherche."),
    ).toBeInTheDocument();
  });

  it("état vide", () => {
    render(<AnnouncementsTable rows={[]} pinnedCount={0} />);
    expect(
      screen.getByText("Aucune annonce. Créez la première."),
    ).toBeInTheDocument();
  });
});

describe("AnnouncementStatePanel", () => {
  const base = {
    announcementId: "1",
    title: "Mon annonce",
    isPublished: true,
    isPinned: false,
    publishedLabel: "publiée il y a 2 h",
    publishedAbsolute: "15 juin 2026, 12:00",
  };

  it("avertit quand 3 annonces ou plus sont déjà épinglées et que celle-ci ne l'est pas", () => {
    const { rerender } = render(
      <AnnouncementStatePanel {...base} pinnedCount={3} />,
    );
    expect(screen.getByTestId("pin-warning")).toBeInTheDocument();

    rerender(<AnnouncementStatePanel {...base} pinnedCount={2} />);
    expect(screen.queryByTestId("pin-warning")).not.toBeInTheDocument();

    rerender(<AnnouncementStatePanel {...base} isPinned pinnedCount={3} />);
    expect(screen.queryByTestId("pin-warning")).not.toBeInTheDocument();
  });

  it("un brouillon indique qu'il n'est pas visible et propose « Publier »", () => {
    render(
      <AnnouncementStatePanel
        {...base}
        isPublished={false}
        publishedLabel="jamais publiée"
        publishedAbsolute=""
        pinnedCount={0}
      />,
    );
    expect(screen.getByText("Brouillon")).toBeInTheDocument();
    expect(
      screen.getByText(/non visible des utilisateurs/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publier Mon annonce" }),
    ).toBeInTheDocument();
  });
});

describe("AnnouncementDeleteZone", () => {
  it("le bouton reste désactivé tant que la confirmation n'est pas cochée", () => {
    render(<AnnouncementDeleteZone announcementId="1" />);

    const button = screen.getByRole("button", {
      name: "Supprimer définitivement",
    });
    expect(button).toBeDisabled();

    fireEvent.click(
      screen.getByLabelText(/Je confirme la suppression définitive/),
    );
    expect(button).toBeEnabled();

    fireEvent.click(
      screen.getByLabelText(/Je confirme la suppression définitive/),
    );
    expect(button).toBeDisabled();
  });
});
