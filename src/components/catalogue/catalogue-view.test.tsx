import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { CatalogueView } from "@/components/catalogue/catalogue-view";
import { makeCard } from "@/lib/catalogue/fixtures";

const apps = [
  makeCard({ name: "Outil entrepôts", category: "Entrepôts" }),
  makeCard({ name: "Comptes rendus", category: "Entrepôts" }),
  makeCard({
    name: "Annuaire des sites",
    category: "Référentiel",
    openUrl: null,
  }),
];

const none = { q: "", cat: "" };

function titles() {
  return screen
    .queryAllByRole("heading", { level: 2 })
    .map((h) => h.textContent);
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("CatalogueView", () => {
  it("affiche toutes les apps et le compteur", () => {
    render(<CatalogueView apps={apps} initialFilters={none} />);
    expect(titles()).toEqual([
      "Outil entrepôts",
      "Comptes rendus",
      "Annuaire des sites",
    ]);
    expect(screen.getByTestId("result-count")).toHaveTextContent(
      "3 applications",
    );
    expect(screen.getByTestId("result-count")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("filtre à la saisie (sans accents) et met le compteur à jour", () => {
    render(<CatalogueView apps={apps} initialFilters={none} />);
    fireEvent.change(screen.getByLabelText("Rechercher une application"), {
      target: { value: "outil entrepots" },
    });
    expect(titles()).toEqual(["Outil entrepôts"]);
    expect(screen.getByTestId("result-count")).toHaveTextContent(
      "1 application",
    );
    expect(screen.getByTestId("result-count")).not.toHaveTextContent(
      "applications",
    );
  });

  it("filtre par catégorie avec aria-pressed", () => {
    render(<CatalogueView apps={apps} initialFilters={none} />);
    const all = screen.getByRole("button", { name: "Toutes" });
    const ref = screen.getByRole("button", { name: "Référentiel" });
    expect(all).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(ref);

    expect(ref).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(titles()).toEqual(["Annuaire des sites"]);
  });

  it("combine recherche et catégorie, et reflète l'état dans l'URL", () => {
    render(<CatalogueView apps={apps} initialFilters={none} />);
    fireEvent.click(screen.getByRole("button", { name: "Entrepôts" }));
    fireEvent.change(screen.getByLabelText("Rechercher une application"), {
      target: { value: "comptes" },
    });
    expect(titles()).toEqual(["Comptes rendus"]);
    const params = new URLSearchParams(window.location.search);
    expect(params.get("q")).toBe("comptes");
    expect(params.get("cat")).toBe("Entrepôts");
  });

  it("affiche l'état vide d'une recherche et réinitialise les filtres", () => {
    render(<CatalogueView apps={apps} initialFilters={none} />);
    fireEvent.change(screen.getByLabelText("Rechercher une application"), {
      target: { value: "zzz" },
    });
    expect(
      screen.getByText("Aucune application ne correspond à votre recherche."),
    ).toBeInTheDocument();
    expect(screen.getByTestId("result-count")).toHaveTextContent(
      "Aucune application",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Réinitialiser les filtres" }),
    );

    expect(titles()).toHaveLength(3);
    expect(screen.getByLabelText("Rechercher une application")).toHaveValue("");
    expect(window.location.search).toBe("");
  });

  it("lit l'état initial depuis les filtres (paramètres d'URL)", () => {
    render(
      <CatalogueView
        apps={apps}
        initialFilters={{ q: "annuaire", cat: "Référentiel" }}
      />,
    );
    expect(screen.getByLabelText("Rechercher une application")).toHaveValue(
      "annuaire",
    );
    expect(screen.getByRole("button", { name: "Référentiel" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(titles()).toEqual(["Annuaire des sites"]);
  });

  it("affiche le message de catalogue vide", () => {
    render(<CatalogueView apps={[]} initialFilters={none} />);
    expect(
      screen.getByText("Aucune application disponible pour le moment."),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Rechercher une application"),
    ).not.toBeInTheDocument();
  });
});
