import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppCard } from "@/components/catalogue/app-card";
import { makeCard } from "@/lib/catalogue/fixtures";

describe("AppCard", () => {
  it("app en ligne avec URL : bouton « Ouvrir » dans un nouvel onglet, rel sécurisé", () => {
    render(
      <AppCard
        app={makeCard({ name: "Outil", openUrl: "https://example.test/o" })}
      />,
    );

    const link = screen.getByRole("link", { name: /^Ouvrir/ });
    expect(link).toHaveAttribute("href", "https://example.test/o");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(
      screen.getByRole("heading", { level: 2, name: "Outil" }),
    ).toBeInTheDocument();
    expect(screen.getByText("En ligne")).toBeInTheDocument();
  });

  it("app sans URL : « Bientôt disponible » désactivé, aucun lien principal", () => {
    render(<AppCard app={makeCard({ openUrl: null, status: "offline" })} />);

    expect(
      screen.getByRole("button", { name: "Bientôt disponible" }),
    ).toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Hors ligne")).toBeInTheDocument();
  });

  it("maintenance : message de statut visible sur la carte", () => {
    render(
      <AppCard
        app={makeCard({
          status: "maintenance",
          statusMessage: "Retour prévu à 18 h",
        })}
      />,
    );
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Retour prévu à 18 h")).toBeVisible();
  });

  it("hors ligne avec URL : le bouton « Ouvrir » reste présent", () => {
    render(
      <AppCard
        app={makeCard({
          status: "offline",
          statusMessage: "Indisponible",
          openUrl: "https://example.test/x",
        })}
      />,
    );
    expect(screen.getByRole("link", { name: /^Ouvrir/ })).toBeInTheDocument();
    expect(screen.getByText("Indisponible")).toBeInTheDocument();
  });

  it("affiche le badge « Nouveau », la version et l'indication de mise à jour", () => {
    render(
      <AppCard
        app={makeCard({
          isNew: true,
          version: "0.1.0",
          updatedLabel: "mis à jour il y a 2 h",
        })}
      />,
    );
    expect(screen.getByText("Nouveau")).toBeInTheDocument();
    expect(screen.getByText("Version 0.1.0")).toBeInTheDocument();
    expect(screen.getByText("mis à jour il y a 2 h")).toBeInTheDocument();
  });

  it("n'affiche pas « Nouveau » sinon", () => {
    render(<AppCard app={makeCard()} />);
    expect(screen.queryByText("Nouveau")).not.toBeInTheDocument();
  });

  it("lien de documentation sécurisé", () => {
    render(<AppCard app={makeCard({ docUrl: "https://example.test/doc" })} />);
    const doc = screen.getByRole("link", { name: /^Documentation/ });
    expect(doc).toHaveAttribute("href", "https://example.test/doc");
    expect(doc).toHaveAttribute("target", "_blank");
    expect(doc).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("responsable avec lien mailto", () => {
    render(
      <AppCard
        app={makeCard({
          ownerName: "Équipe projet",
          ownerEmail: "equipe@example.test",
        })}
      />,
    );
    expect(screen.getByText(/Responsable : Équipe projet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Contacter/ })).toHaveAttribute(
      "href",
      "mailto:equipe@example.test",
    );
  });

  it("responsable sans email : pas de lien « Contacter »", () => {
    render(<AppCard app={makeCard({ ownerName: "Équipe projet" })} />);
    expect(
      screen.queryByRole("link", { name: /Contacter/ }),
    ).not.toBeInTheDocument();
  });

  it("n'injecte pas de HTML brut venant des données", () => {
    const { container } = render(
      <AppCard
        app={makeCard({
          name: "<img src=x onerror=alert(1)>",
          description: "<script>alert(1)</script>",
        })}
      />,
    );
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(
      within(container).getByText("<script>alert(1)</script>"),
    ).toBeInTheDocument();
  });
});
