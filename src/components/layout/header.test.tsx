import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Header } from "@/components/layout/header";

describe("Header", () => {
  it("affiche le nom « Merlin » et son sous-titre", () => {
    render(<Header />);

    expect(screen.getByText("Merlin")).toBeInTheDocument();
    expect(
      screen.getByText("Le hub des outils Carrefour Property"),
    ).toBeInTheDocument();
  });

  it("affiche toujours le logo (sans dépendre du système de fichiers du serveur)", () => {
    render(<Header />);

    expect(screen.getByAltText("Carrefour Property")).toBeInTheDocument();
  });

  it("affiche le menu utilisateur fourni", () => {
    render(<Header userMenu={<button>Menu</button>} />);

    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });
});
