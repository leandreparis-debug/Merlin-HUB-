import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Footer } from "@/components/layout/footer";

describe("Footer", () => {
  it("affiche l'année courante et la mention des outils internes", () => {
    render(<Footer />);

    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
    expect(
      screen.getByText(/Outils internes Carrefour Property/),
    ).toBeInTheDocument();
  });
});
