import { NextResponse } from "next/server";

import packageJson from "../../../../package.json";

/**
 * Route de santé : confirme que l'application répond, sans exposer
 * d'information sensible (aucun secret, aucune donnée utilisateur).
 */
export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      app: "merlin",
      version: packageJson.version,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
