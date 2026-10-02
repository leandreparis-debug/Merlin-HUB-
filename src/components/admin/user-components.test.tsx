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
  createUserAction: vi.fn(),
  updateUserAction: vi.fn(),
  changeUserRoleAction: vi.fn(),
  setUserActiveAction: vi.fn(),
  resetUserPasswordAction: vi.fn(),
}));
vi.mock("@/app/(app)/admin/users/actions", () => actions);

const { UserCreateForm } = await import("@/components/admin/user-create-form");
const { ProvisionalPasswordPanel, buildLoginInfo } =
  await import("@/components/admin/provisional-password-panel");
const { UserAccessForm, UserPasswordForm, UserRoleForm } =
  await import("@/components/admin/user-detail-forms");
const { UsersTable } = await import("@/components/admin/users-table");

import type {
  AdminUserDetail,
  AdminUserRow,
} from "@/lib/admin/users/view-models";

const LOGIN_URL = "https://merlin.example.test/login";
const PASSWORD = "Tk7!mQp2#Xv9&Rb4Wz8-";

beforeEach(() => {
  vi.clearAllMocks();
});

function submitForm(button: HTMLElement) {
  const form = button.closest("form");
  if (!form) throw new Error("formulaire introuvable");
  return act(async () => {
    fireEvent.submit(form);
  });
}

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe("UserCreateForm", () => {
  it("affiche les erreurs par champ avec aria-describedby et un résumé role=alert", async () => {
    actions.createUserAction.mockResolvedValueOnce({
      ok: false,
      message: "Le formulaire contient des erreurs.",
      fieldErrors: { email: "Un compte existe déjà avec cet email" },
    });
    render(<UserCreateForm loginUrl={LOGIN_URL} />);

    await submitForm(screen.getByRole("button", { name: "Créer le compte" }));

    const email = screen.getByLabelText("Email professionnel *");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email.getAttribute("aria-describedby")).toContain("email-error");
    expect(document.getElementById("email-error")).toHaveTextContent(
      "Un compte existe déjà avec cet email",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Le formulaire contient des erreurs.",
    );
    await waitFor(() => expect(email).toHaveFocus());
  });

  it("avertit visiblement du rôle Admin et explique le déroulé du mot de passe provisoire", () => {
    render(<UserCreateForm loginUrl={LOGIN_URL} />);
    expect(screen.queryByTestId("admin-role-warning")).not.toBeInTheDocument();
    expect(screen.getByText(/affiché une seule fois/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Rôle"), {
      target: { value: "admin" },
    });
    expect(screen.getByTestId("admin-role-warning")).toBeVisible();
  });

  it("remplace le formulaire par le panneau du mot de passe, qui disparaît après « J'ai noté le mot de passe »", async () => {
    actions.createUserAction.mockResolvedValueOnce({
      ok: true,
      message: "Le compte a été créé.",
      provisional: {
        email: "nina@example.test",
        password: PASSWORD,
        userId: "u1",
      },
    });
    render(<UserCreateForm loginUrl={LOGIN_URL} />);

    await submitForm(screen.getByRole("button", { name: "Créer le compte" }));

    expect(screen.getByTestId("provisional-password")).toHaveTextContent(
      PASSWORD,
    );
    expect(
      screen.queryByLabelText("Email professionnel *"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Créer un autre utilisateur" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voir la fiche/ })).toHaveAttribute(
      "href",
      "/admin/users/u1",
    );

    fireEvent.click(
      screen.getByRole("button", { name: /J'ai noté le mot de passe/ }),
    );

    expect(document.body).not.toHaveTextContent(PASSWORD);
    expect(screen.getByTestId("user-created-done")).toHaveTextContent(
      "nina@example.test",
    );
  });
});

describe("ProvisionalPasswordPanel", () => {
  function renderPanel(onAcknowledge = vi.fn()) {
    render(
      <ProvisionalPasswordPanel
        email="nina@example.test"
        password={PASSWORD}
        loginUrl={LOGIN_URL}
        onAcknowledge={onAcknowledge}
      />,
    );
    return onAcknowledge;
  }

  it("affiche email, mot de passe sélectionnable, adresse de connexion et bandeau d'avertissement", () => {
    renderPanel();
    expect(screen.getByText("nina@example.test")).toBeInTheDocument();
    expect(screen.getByTestId("provisional-password")).toHaveClass(
      "select-all",
    );
    expect(screen.getByText(LOGIN_URL)).toBeInTheDocument();
    expect(
      screen.getByText(/Ce mot de passe ne sera plus affiché\. Transmettez-le/),
    ).toBeInTheDocument();
  });

  it("copie le mot de passe puis les informations de connexion, avec retour aria-live", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    mockClipboard(writeText);
    renderPanel();

    fireEvent.click(
      screen.getByRole("button", { name: "Copier le mot de passe" }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PASSWORD));
    const feedback = await screen.findByText("Mot de passe copié.");
    expect(feedback).toHaveAttribute("aria-live", "polite");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Copier les informations de connexion",
      }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    const info = writeText.mock.calls[1]?.[0] ?? "";
    expect(info).toBe(
      buildLoginInfo({
        loginUrl: LOGIN_URL,
        email: "nina@example.test",
        password: PASSWORD,
      }),
    );
    expect(info).toContain(LOGIN_URL);
    expect(info).toContain("première connexion");
    await screen.findByText("Informations de connexion copiées.");
  });

  it("indique que la copie est impossible quand le presse-papiers est indisponible", async () => {
    mockClipboard(async () => {
      throw new Error("refusé");
    });
    renderPanel();
    fireEvent.click(
      screen.getByRole("button", { name: "Copier le mot de passe" }),
    );
    await screen.findByText(/Copie impossible/);
    expect(screen.getByTestId("provisional-password")).toHaveTextContent(
      PASSWORD,
    );
  });

  it("appelle onAcknowledge", () => {
    const onAcknowledge = renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /J'ai noté/ }));
    expect(onAcknowledge).toHaveBeenCalledTimes(1);
  });
});

function userDetail(overrides: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: "u2",
    email: "camille@example.test",
    fullName: "Camille",
    role: "user",
    isActive: true,
    mustChangePassword: false,
    isSelf: false,
    createdAbsolute: "1 janv. 2026, 10:00",
    lastLoginAbsolute: "",
    lastLoginLabel: "Jamais connecté",
    updatedAt: "2026-01-02T10:00:00Z",
    permissions: {
      changeRole: { allowed: true },
      deactivate: { allowed: true },
      resetPassword: { allowed: true },
    },
    ...overrides,
  };
}

describe("fiche utilisateur : contrôles et garde-fous", () => {
  it("désactive rôle, désactivation et réinitialisation pour soi-même, avec explication", () => {
    const self = userDetail({
      isSelf: true,
      role: "admin",
      permissions: {
        changeRole: {
          allowed: false,
          reason: "Vous ne pouvez pas modifier votre propre rôle.",
        },
        deactivate: {
          allowed: false,
          reason: "Vous ne pouvez pas désactiver votre propre compte.",
        },
        resetPassword: {
          allowed: false,
          reason: "Utilisez « Changer mon mot de passe ».",
        },
      },
    });
    render(
      <>
        <UserRoleForm user={self} />
        <UserAccessForm user={self} />
        <UserPasswordForm user={self} loginUrl={LOGIN_URL} />
      </>,
    );

    expect(screen.getByLabelText("Rôle")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Changer le rôle" }),
    ).toBeDisabled();
    expect(screen.getByTestId("role-rule")).toHaveTextContent("propre rôle");
    expect(
      screen.getByLabelText("Rôle").getAttribute("aria-describedby"),
    ).toContain("role-rule");

    expect(screen.getByLabelText(/confirme la désactivation/)).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Désactiver le compte" }),
    ).toBeDisabled();
    expect(screen.getByTestId("deactivate-rule")).toHaveTextContent(
      "propre compte",
    );

    expect(
      screen.getByLabelText(/confirme la réinitialisation/),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Réinitialiser le mot de passe" }),
    ).toBeDisabled();
    expect(screen.getByTestId("reset-rule")).toBeInTheDocument();
  });

  it("explique le blocage du dernier admin actif", () => {
    const last = userDetail({
      role: "admin",
      permissions: {
        changeRole: {
          allowed: false,
          reason: "Impossible de rétrograder le dernier administrateur actif.",
        },
        deactivate: {
          allowed: false,
          reason: "Impossible de désactiver le dernier administrateur actif.",
        },
        resetPassword: { allowed: true },
      },
    });
    render(<UserAccessForm user={last} />);
    expect(screen.getByTestId("deactivate-rule")).toHaveTextContent(
      "dernier administrateur actif",
    );
    expect(
      screen.getByRole("button", { name: "Désactiver le compte" }),
    ).toBeDisabled();
  });

  it("exige une confirmation avant la désactivation puis envoie la demande", async () => {
    actions.setUserActiveAction.mockResolvedValueOnce({
      ok: true,
      message: "Le compte a été désactivé.",
    });
    render(<UserAccessForm user={userDetail()} />);
    const button = screen.getByRole("button", { name: "Désactiver le compte" });

    expect(button).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/confirme la désactivation/));
    expect(button).toBeEnabled();

    await submitForm(button);
    const sent = actions.setUserActiveAction.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id")).toBe("u2");
    expect(sent.get("active")).toBe("false");
    expect(
      await screen.findByText("Le compte a été désactivé."),
    ).toBeInTheDocument();
  });

  it("propose « Réactiver le compte » pour un compte désactivé, sans confirmation", () => {
    render(<UserAccessForm user={userDetail({ isActive: false })} />);
    expect(
      screen.getByRole("button", { name: "Réactiver le compte" }),
    ).toBeEnabled();
    expect(screen.getByText(/historique/)).toBeInTheDocument();
  });

  it("exige une confirmation avant la réinitialisation, affiche le panneau puis le fait disparaître", async () => {
    actions.resetUserPasswordAction.mockResolvedValueOnce({
      ok: true,
      message: "Le mot de passe a été réinitialisé.",
      provisional: {
        email: "camille@example.test",
        password: PASSWORD,
        userId: "u2",
      },
    });
    render(<UserPasswordForm user={userDetail()} loginUrl={LOGIN_URL} />);
    const button = screen.getByRole("button", {
      name: "Réinitialiser le mot de passe",
    });

    expect(button).toBeDisabled();
    expect(
      screen.getByText(/ancien mot de passe cessera de fonctionner/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/confirme la réinitialisation/));
    await submitForm(button);

    expect(screen.getByTestId("provisional-password")).toHaveTextContent(
      PASSWORD,
    );
    fireEvent.click(screen.getByRole("button", { name: /J'ai noté/ }));
    expect(document.body).not.toHaveTextContent(PASSWORD);
    expect(screen.getByText(/n'est plus affiché/)).toBeInTheDocument();
  });
});

describe("UsersTable", () => {
  const rows: AdminUserRow[] = [
    {
      id: "a",
      fullName: "Alex Admin",
      email: "alex@example.test",
      role: "admin",
      isActive: true,
      mustChangePassword: false,
      lastLoginLabel: "il y a 2 h",
      isSelf: true,
    },
    {
      id: "b",
      fullName: "Camille",
      email: "camille@example.test",
      role: "user",
      isActive: true,
      mustChangePassword: true,
      lastLoginLabel: "Jamais connecté",
      isSelf: false,
    },
    {
      id: "c",
      fullName: "Denis",
      email: "denis@example.test",
      role: "user",
      isActive: false,
      mustChangePassword: false,
      lastLoginLabel: "hier",
      isSelf: false,
    },
  ];
  const none = { q: "", filter: "all" as const };

  beforeEach(() => window.history.replaceState(null, "", "/"));

  it("marque la ligne « Vous », l'état et la première connexion en attente en texte", () => {
    render(<UsersTable rows={rows} initialFilters={none} />);
    const [alex, camille, denis] = screen.getAllByTestId("user-row");
    expect(within(alex!).getByText("Vous")).toBeInTheDocument();
    expect(within(alex!).getByText("Admin")).toBeInTheDocument();
    expect(
      within(camille!).getByText("Première connexion en attente"),
    ).toBeInTheDocument();
    expect(within(camille!).getByText("Jamais connecté")).toBeInTheDocument();
    expect(within(denis!).getByText("Désactivé")).toBeInTheDocument();
    expect(screen.getByTestId("users-count")).toHaveTextContent(
      "3 utilisateurs",
    );
    expect(screen.getByTestId("users-count")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("filtre avec aria-pressed, combine avec la recherche et reflète l'état dans l'URL", () => {
    render(<UsersTable rows={rows} initialFilters={none} />);
    const inactive = screen.getByRole("button", { name: "Désactivés" });
    fireEvent.click(inactive);
    expect(inactive).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tous" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getAllByTestId("user-row")).toHaveLength(1);
    expect(new URLSearchParams(window.location.search).get("filter")).toBe(
      "inactive",
    );

    fireEvent.click(screen.getByRole("button", { name: "Tous" }));
    fireEvent.change(screen.getByLabelText("Rechercher un utilisateur"), {
      target: { value: "CAMILLE" },
    });
    expect(screen.getAllByTestId("user-row")).toHaveLength(1);
    expect(new URLSearchParams(window.location.search).get("q")).toBe(
      "CAMILLE",
    );
  });

  it("affiche l'état vide d'une recherche avec réinitialisation, et l'état initial issu de l'URL", () => {
    render(
      <UsersTable
        rows={rows}
        initialFilters={{ q: "zzz", filter: "admins" }}
      />,
    );
    expect(screen.getByRole("button", { name: "Admins" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("users-no-results")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Réinitialiser les filtres" }),
    );
    expect(screen.getAllByTestId("user-row")).toHaveLength(3);
  });

  it("affiche l'état vide quand il n'y a aucun compte", () => {
    render(<UsersTable rows={[]} initialFilters={none} />);
    expect(screen.getByTestId("users-empty")).toBeInTheDocument();
  });
});
