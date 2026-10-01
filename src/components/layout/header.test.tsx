import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const existsSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:fs", () => ({
  default: { existsSync: existsSyncMock },
  existsSync: existsSyncMock,
}));

const { Header } = await import("@/components/layout/header");

describe("Header", () => {
  beforeEach(() => {
    existsSyncMock.mockReset();
  });

  it("affiche le nom « Merlin » et son sous-titre", () => {
    existsSyncMock.mockReturnValue(true);
    render(<Header />);

    expect(screen.getByText("Merlin")).toBeInTheDocument();
    expect(
      screen.getByText("Le hub des outils Carrefour Property"),
    ).toBeInTheDocument();
  });

  it("affiche le logo quand le fichier est disponible", () => {
    existsSyncMock.mockReturnValue(true);
    render(<Header />);

    expect(screen.getByAltText("Carrefour Property")).toBeInTheDocument();
  });

  it("affiche un repli textuel quand le logo est indisponible", () => {
    existsSyncMock.mockReturnValue(false);
    render(<Header />);

    expect(screen.getByText("Carrefour Property")).toBeInTheDocument();
    expect(screen.queryByAltText("Carrefour Property")).not.toBeInTheDocument();
  });
});
