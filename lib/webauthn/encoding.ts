// base64url + hashing helpers, environment-agnostic.
//
// Uses only globals present in browsers, the Workers runtime, and Node ≥18:
// atob/btoa, TextEncoder/TextDecoder, and crypto.subtle. So the same code runs
// client-side (enroll/assert) and server-side (verify, in a Pages Function).

export function bytesToB64Url(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64UrlToBytes(s: string): Uint8Array {
  let b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad === 2) b64 += "==";
  else if (pad === 3) b64 += "=";
  else if (pad === 1) throw new Error("invalid base64url length");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function utf8ToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** SHA-256 of bytes, as raw bytes. */
export async function sha256Bytes(
  data: Uint8Array | ArrayBuffer,
): Promise<Uint8Array> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  // Cast quiets the lib's ArrayBufferLike-vs-ArrayBuffer union (no
  // SharedArrayBuffer reaches here); mirrors lib/pack/hash.ts.
  const digest = await crypto.subtle.digest("SHA-256", buf as BufferSource);
  return new Uint8Array(digest);
}

/** SHA-256 of a string (UTF-8) or bytes, as lowercase hex. */
export async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === "string" ? utf8ToBytes(data) : data;
  const out = await sha256Bytes(bytes);
  let hex = "";
  for (let i = 0; i < out.length; i++) hex += out[i].toString(16).padStart(2, "0");
  return hex;
}

/** Constant-time comparison of two byte arrays (avoids early-exit timing leaks). */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
