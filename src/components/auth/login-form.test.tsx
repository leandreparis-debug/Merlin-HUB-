import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const loginAction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/actions", () => ({ loginAction }));

const { LoginForm } = await import("@/components/auth/login-form");

function submitForm(): HTMLFormElement {
  const form = screen
    .getByRole("button", { name: "Se connecter" })
    .closest("form");
  if (!form) throw new Error("formulaire introuvable");
  return form;
}

describe("LoginForm", () => {
  it("expose des champs correctement libellés avec les attributs autocomplete attendus", () => {
    render(<LoginForm next="/" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText("Mot de passe")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(
      screen.getByText(/Mot de passe oublié \? Contactez l'administrateur/),
    ).toBeInTheDocument();
  });

  it("affiche le contact administrateur en mailto quand il est défini", () => {
    render(<LoginForm next="/" contactEmail="admin@carrefour.test" />);
    expect(
      screen.getByRole("link", { name: "admin@carrefour.test" }),
    ).toHaveAttribute("href", "mailto:admin@carrefour.test");
  });

  it("affiche ou masque le mot de passe", () => {
    render(<LoginForm next="/" />);
    const input = screen.getByLabelText("Mot de passe");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(
      screen.getByRole("button", { name: "Afficher le mot de passe" }),
    );
    expect(input).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Masquer le mot de passe" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("affiche l'erreur dans une zone role=alert", async () => {
    loginAction.mockResolvedValueOnce({
      error: "Email ou mot de passe incorrect",
      email: "a@example.test",
    });
    render(<LoginForm next="/" />);

    await act(async () => {
      fireEvent.submit(submitForm());
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email ou mot de passe incorrect",
    );
    expect(screen.getByLabelText("Email")).toHaveValue("a@example.test");
  });

  it("désactive le bouton pendant l'envoi", async () => {
    let finish: (value: object) => void = () => {};
    loginAction.mockImplementationOnce(
      () => new Promise((resolve) => (finish = resolve)),
    );
    render(<LoginForm next="/" />);

    await act(async () => {
      fireEvent.submit(submitForm());
    });
    expect(screen.getByRole("button", { name: "Connexion…" })).toBeDisabled();

    await act(async () => finish({}));
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeEnabled();
  });
});
