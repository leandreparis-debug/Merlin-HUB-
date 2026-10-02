import { describe, expect, it } from "vitest";

import { validateNewPassword } from "@/lib/auth/password-policy";
import {
  PROVISIONAL_PASSWORD_ALPHABET,
  PROVISIONAL_PASSWORD_SYMBOLS,
  generatePassword,
  generateProvisionalPassword,
} from "@/lib/auth/provisional-password";

describe("generateProvisionalPassword", () => {
  const email = "jean.dupont@carrefour.test";

  it("génère 20 caractères", () => {
    expect(generateProvisionalPassword(email)).toHaveLength(20);
  });

  it("n'utilise jamais de caractère ambigu (0 O 1 l I)", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateProvisionalPassword(email)).not.toMatch(/[0O1lI]/);
    }
    expect(PROVISIONAL_PASSWORD_ALPHABET).not.toMatch(/[0O1lI]/);
  });

  it("contient au moins une majuscule, une minuscule, un chiffre et un symbole", () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generateProvisionalPassword(email);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[0-9]/);
      expect(
        [...PROVISIONAL_PASSWORD_SYMBOLS].some((symbol) =>
          password.includes(symbol),
        ),
      ).toBe(true);
    }
  });

  it("donne des valeurs différentes à chaque appel", () => {
    const values = new Set(
      Array.from({ length: 50 }, () => generateProvisionalPassword(email)),
    );
    expect(values.size).toBe(50);
  });

  it("ne contient jamais la partie locale de l'email (casse ignorée)", () => {
    // Partie locale courte (3 caractères) : fréquente dans un mot de passe
    // aléatoire, donc régénération régulière.
    for (let i = 0; i < 500; i += 1) {
      const password = generateProvisionalPassword("aB2@carrefour.test");
      expect(password.toLowerCase()).not.toContain("ab2");
    }
  });

  it("satisfait la politique de mot de passe existante", () => {
    for (let i = 0; i < 50; i += 1) {
      const password = generateProvisionalPassword(email);
      expect(
        validateNewPassword({
          newPassword: password,
          currentPassword: "x",
          email,
        }),
      ).toEqual({ ok: true });
    }
  });
});

describe("generatePassword", () => {
  it("respecte la longueur demandée", () => {
    expect(generatePassword()).toHaveLength(20);
    expect(generatePassword(32)).toHaveLength(32);
  });
});
