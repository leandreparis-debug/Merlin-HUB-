/**
 * Cookie de session signé HMAC-SHA256 de l'implémentation mémoire. Utilise
 * Web Crypto (et non `node:crypto`) pour être exécutable aussi dans le
 * middleware (Edge runtime).
 */

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Charge utile d'un cookie de session : identifiant utilisateur et expiration (ms epoch). */
export interface SessionCookiePayload {
  uid: string;
  exp: number;
}

/** Produit `base64url(payload).base64url(hmac)`. */
export async function signSessionCookie(
  payload: SessionCookiePayload,
  secret: string,
): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Vérifie la signature (comparaison en temps constant via `subtle.verify`) et
 * l'expiration. Retourne `null` pour tout cookie falsifié, malformé ou expiré.
 */
export async function verifySessionCookie(
  value: string | undefined,
  secret: string,
  nowMs: number = Date.now(),
): Promise<SessionCookiePayload | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];

  const signatureBytes = fromBase64Url(signature);
  if (!signatureBytes) return null;

  const key = await importKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(body),
  );
  if (!valid) return null;

  const bodyBytes = fromBase64Url(body);
  if (!bodyBytes) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(bodyBytes)) as unknown;
    if (
      typeof payload === "object" &&
      payload !== null &&
      typeof (payload as SessionCookiePayload).uid === "string" &&
      typeof (payload as SessionCookiePayload).exp === "number" &&
      (payload as SessionCookiePayload).exp > nowMs
    ) {
      return payload as SessionCookiePayload;
    }
  } catch {
    // charge utile illisible : traité comme invalide
  }
  return null;
}
