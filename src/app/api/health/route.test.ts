import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("renvoie un statut 200, le JSON attendu et l'en-tête Cache-Control", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", app: "merlin" });
    expect(typeof body.version).toBe("string");
    expect(typeof body.timestamp).toBe("string");
  });
});
