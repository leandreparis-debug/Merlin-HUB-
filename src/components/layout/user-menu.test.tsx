import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  logoutAction: vi.fn(async () => undefined),
  toggleViewModeAction: vi.fn(async () => undefined),
}));
vi.mock("@/lib/auth/actions", () => actions);

const { UserMenu } = await import("@/components/layout/user-menu");
const { ViewModeBanner } = await import("@/components/layout/view-mode-banner");

const admin = {
  email: "admin@example.test",
  fullName: "Alex Admin",
  role: "admin" as const,
  mustChangePassword: false,
};
const user = {
  email: "user@example.test",
  fullName: null,
  role: "user" as const,
  mustChangePassword: false,
};

beforeAll(() => {
  // jsdom n'implémente pas ces API utilisées par Radix (positionnement).
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function openMenu() {
  const trigger = screen.getByRole("button", { name: /Menu utilisateur/ });
  fireEvent.keyDown(trigger, { key: "Enter" });
  await screen.findByRole("menu");
}

describe("UserMenu", () => {
  it("un admin en vue admin voit l'espace administration et la bascule", async () => {
    render(<UserMenu user={admin} viewMode="admin" />);
    await openMenu();

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Espace administration" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Passer en vue utilisateur" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Changer mon mot de passe" }),
    ).toBeInTheDocument();
  });

  it("un admin en vue utilisateur propose de revenir en vue admin, sans espace administration", async () => {
    render(<UserMenu user={admin} viewMode="user" />);
    await openMenu();

    expect(
      screen.getByRole("menuitem", { name: "Revenir en vue admin" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Espace administration" }),
    ).not.toBeInTheDocument();
  });

  it("un utilisateur simple ne voit ni bascule ni espace administration", async () => {
    render(<UserMenu user={user} viewMode="user" />);
    await openMenu();

    expect(screen.getByText("Utilisateur")).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /vue/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "Espace administration" }),
    ).not.toBeInTheDocument();
  });

  it("en changement de mot de passe forcé, seule la déconnexion est proposée", async () => {
    render(
      <UserMenu user={{ ...user, mustChangePassword: true }} viewMode="user" />,
    );
    await openMenu();

    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    expect(
      screen.getByRole("menuitem", { name: "Se déconnecter" }),
    ).toBeInTheDocument();
  });

  it("déclenche la bascule et la déconnexion", async () => {
    render(<UserMenu user={admin} viewMode="admin" />);
    await openMenu();
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Passer en vue utilisateur" }),
    );
    await waitFor(() =>
      expect(actions.toggleViewModeAction).toHaveBeenCalledTimes(1),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Menu utilisateur/ }),
      ).not.toBeDisabled(),
    );
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Se déconnecter" }));
    await waitFor(() => expect(actions.logoutAction).toHaveBeenCalledTimes(1));
  });
});

describe("ViewModeBanner", () => {
  it("annonce la vue utilisateur et propose de revenir en vue admin", () => {
    render(<ViewModeBanner />);
    expect(
      screen.getByText("Vous consultez Merlin comme un utilisateur"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Revenir en vue admin" }),
    ).toBeInTheDocument();
  });
});
