import { describe, expect, it } from "vitest";

import {
  announcementBodySchema,
  announcementTitleSchema,
  createAnnouncementInputSchema,
  normalizeAnnouncementText,
  updateAnnouncementInputSchema,
} from "@/lib/data/schemas";

describe("normalizeAnnouncementText", () => {
  it("normalise les fins de ligne, retire les caractères de contrôle et rogne les bords", () => {
    expect(normalizeAnnouncementText("  a\r\nb\rc\u0000\u0007\u007f  ")).toBe(
      "a\nb\nc",
    );
  });

  it("conserve les retours à la ligne et les tabulations", () => {
    expect(normalizeAnnouncementText("a\n\tb")).toBe("a\n\tb");
  });
});

describe("schémas d'annonce", () => {
  it("accepte un titre de 120 caractères et refuse 121", () => {
    expect(announcementTitleSchema.safeParse("x".repeat(120)).success).toBe(
      true,
    );
    const tooLong = announcementTitleSchema.safeParse("x".repeat(121));
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]?.message).toBe(
      "Le titre ne doit pas dépasser 120 caractères",
    );
  });

  it("refuse un titre ou un texte vide ou fait d'espaces, avec un message français", () => {
    expect(
      announcementTitleSchema.safeParse("   ").error?.issues[0]?.message,
    ).toBe("Le titre est requis");
    expect(
      announcementBodySchema.safeParse(" \n\t ").error?.issues[0]?.message,
    ).toBe("Le texte est requis");
  });

  it("compte la longueur après normalisation (2000 max)", () => {
    expect(announcementBodySchema.safeParse("x".repeat(2000)).success).toBe(
      true,
    );
    expect(announcementBodySchema.safeParse("x".repeat(2001)).success).toBe(
      false,
    );
    expect(
      announcementBodySchema.safeParse(`${"x".repeat(2000)}\u0000\u0000`)
        .success,
    ).toBe(true);
  });

  it("garde le HTML tel quel (texte brut, aucune interprétation)", () => {
    expect(announcementBodySchema.parse("<b>gras</b> <script>x</script>")).toBe(
      "<b>gras</b> <script>x</script>",
    );
  });

  it("create et update appliquent les mêmes règles", () => {
    expect(
      createAnnouncementInputSchema.safeParse({ title: "", body: "ok" })
        .success,
    ).toBe(false);
    expect(
      updateAnnouncementInputSchema.safeParse({ body: "x".repeat(2001) })
        .success,
    ).toBe(false);
    expect(updateAnnouncementInputSchema.safeParse({}).success).toBe(true);
  });
});
