import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AnnouncementCard } from "@/components/announcements/announcement-card";
import { AnnouncementsZone } from "@/components/announcements/announcements-zone";
import type { AnnouncementCardModel } from "@/lib/announcements/view-model";

function model(
  overrides: Partial<AnnouncementCardModel> = {},
): AnnouncementCardModel {
  return {
    id: overrides.id ?? overrides.title ?? "a",
    title: "Titre",
    text: "Texte",
    pinned: false,
    publishedLabel: "publiée il y a 2 h",
    publishedAbsolute: "15 juin 2026, 12:00",
    publishedAt: "2026-06-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("AnnouncementCard", () => {
  it("affiche le titre (h3), la date relative et le texte", () => {
    render(<AnnouncementCard announcement={model({ title: "Maintenance" })} />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Maintenance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("publiée il y a 2 h")).toBeInTheDocument();
    expect(screen.getByText("Texte")).toBeInTheDocument();
    expect(screen.getByTestId("announcement-card")).toBeInTheDocument();
  });

  it("une annonce épinglée affiche le texte « Épinglée » (pas seulement une icône)", () => {
    render(<AnnouncementCard announcement={model({ pinned: true })} />);
    expect(screen.getByText("Épinglée")).toBeInTheDocument();
  });

  it("une annonce non épinglée n'affiche pas « Épinglée »", () => {
    render(<AnnouncementCard announcement={model()} />);
    expect(screen.queryByText("Épinglée")).not.toBeInTheDocument();
  });

  it("conserve les retours à la ligne (white-space: pre-line)", () => {
    render(
      <AnnouncementCard announcement={model({ text: "Ligne 1\nLigne 2" })} />,
    );
    const paragraph = screen.getByText(/Ligne 1/);
    expect(paragraph.textContent).toBe("Ligne 1\nLigne 2");
    expect(paragraph.className).toContain("whitespace-pre-line");
  });

  it("affiche littéralement <script> et <b>, sans les interpréter", () => {
    const { container } = render(
      <AnnouncementCard
        announcement={model({
          title: "<b>Titre</b>",
          text: "<script>alert(1)</script> <b>gras</b>",
        })}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "<b>Titre</b>",
    );
    expect(
      screen.getByText("<script>alert(1)</script> <b>gras</b>"),
    ).toBeInTheDocument();
  });

  it("ne replie pas un texte court : pas de « Lire la suite »", () => {
    render(
      <AnnouncementCard announcement={model({ text: "x".repeat(280) })} />,
    );
    expect(screen.queryByText(/Lire la suite/)).not.toBeInTheDocument();
  });

  it("replie un texte de plus de 280 caractères derrière un « Lire la suite » natif (<details>)", () => {
    const text = `${"mot ".repeat(100)}fin`;
    const { container } = render(
      <AnnouncementCard announcement={model({ title: "Long", text })} />,
    );

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    const summary = within(details as HTMLElement).getByText(/Lire la suite/);
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary).toHaveTextContent("Lire la suite de l'annonce Long");
    // Rien n'est perdu : tête + suite = texte complet.
    const head = screen.getAllByText(/mot/)[0] as HTMLElement;
    const tail = (details as HTMLElement).querySelector("p") as HTMLElement;
    expect((head.textContent ?? "").replace("…", "") + tail.textContent).toBe(
      text,
    );
  });

  it("affiche la date absolue en plus quand demandé", () => {
    render(<AnnouncementCard announcement={model()} showAbsoluteDate />);
    expect(screen.getByText(/15 juin 2026, 12:00/)).toBeInTheDocument();
  });
});

describe("AnnouncementsZone", () => {
  it("ne rend rien sans annonce", () => {
    const { container } = render(
      <AnnouncementsZone items={[]} hasMore={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("rend le h2 « Annonces » et une carte par annonce, avec le testid de la zone", () => {
    render(
      <AnnouncementsZone
        items={[model({ title: "A" }), model({ title: "B" })]}
        hasMore={false}
      />,
    );

    const zone = screen.getByTestId("announcements-zone");
    expect(
      within(zone).getByRole("heading", { level: 2, name: "Annonces" }),
    ).toBeInTheDocument();
    expect(within(zone).getAllByTestId("announcement-card")).toHaveLength(2);
    expect(screen.queryByText("Toutes les annonces")).not.toBeInTheDocument();
  });

  it("affiche le lien « Toutes les annonces » quand d'autres existent", () => {
    render(<AnnouncementsZone items={[model()]} hasMore />);
    expect(
      screen.getByRole("link", { name: "Toutes les annonces" }),
    ).toHaveAttribute("href", "/announcements");
  });

  it("en cas d'indisponibilité : message discret, pas de zone", () => {
    render(<AnnouncementsZone items={[]} hasMore={false} unavailable />);
    expect(
      screen.getByText("Les annonces sont indisponibles pour le moment."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("announcements-zone")).not.toBeInTheDocument();
  });

  it("n'utilise pas les testids du catalogue", () => {
    render(<AnnouncementsZone items={[model()]} hasMore={false} />);
    expect(screen.queryByTestId("app-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-grid")).not.toBeInTheDocument();
  });
});
