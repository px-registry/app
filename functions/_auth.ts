// Shared helpers for the auth Functions. Leading underscore = not routed.
//
// PX's identity model in one file: a handle maps to a stored public key + a
// recovery-code hash (never a secret, never PII). Sessions and WebAuthn
// challenges are carried in HMAC-signed, HttpOnly cookies — stateless, so no
// session store is needed; only the durable handle→credential record lives in
// KV. The HMAC secret is AUTH_SECRET (a Pages secret in production).
//
// Server-side signature verification lives in lib/webauthn/verify.ts; the
// encoding helpers are shared with that module via relative imports (the Pages
// build bundles these with esbuild, which has no "@/*" alias).

import {
  bytesToB64Url,
  b64UrlToBytes,
  utf8ToBytes,
  bytesToUtf8,
  sha256Hex,
  timingSafeEqual,
} from "../lib/webauthn/encoding.ts";
import { getWebAuthnRpId } from "../lib/webauthn/rp.ts";
import { PX_REGISTRY_DOMAIN } from "../lib/handle/index.ts";

export interface AuthEnv {
  /** KV namespace bound in wrangler.toml ([[kv_namespaces]] binding = "AUTH"). */
  AUTH: KVNamespace;
  /** HMAC secret for session + challenge cookies. Set as a Pages secret. */
  AUTH_SECRET?: string;
}

/** The durable record PX keeps for an owner. No secret, no PII. */
export interface OwnerRecord {
  handle: string;
  /** base64url credential rawId. */
  credential_id: string;
  /** ES256 public key (JWK). */
  public_key_jwk: JsonWebKey;
  /** SHA-256 hex of the recovery code (the plaintext never reaches us). */
  recovery_code_hash: string;
  display_name?: string;
  default_category?: string;
  created_at: string;
}

export const SESSION_COOKIE = "__px_session";
export const CHALLENGE_COOKIE = "__px_chal";
const SESSION_TTL_S = 30 * 86_400; // 30 days
const CHALLENGE_TTL_S = 300; // 5 minutes
// A fallback secret only for local dev. Production MUST set AUTH_SECRET as a
// Pages secret; sessions signed with this dev value are worthless off-localhost.
const DEV_SECRET = "px-dev-insecure-secret-set-AUTH_SECRET-in-prod";

// ── KV record ───────────────────────────────────────────────────────────────

const recordKey = (handle: string) => `handle:${handle}`;

export async function getOwner(
  env: AuthEnv,
  handle: string,
): Promise<OwnerRecord | null> {
  return env.AUTH.get<OwnerRecord>(recordKey(handle), "json");
}

export async function putOwner(env: AuthEnv, rec: OwnerRecord): Promise<void> {
  await env.AUTH.put(recordKey(rec.handle), JSON.stringify(rec));
}

// ── HMAC + signed tokens ──────────────────────────────────────────────────────

function secretOf(env: AuthEnv): string {
  return env.AUTH_SECRET || DEV_SECRET;
}

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8ToBytes(secret) as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    utf8ToBytes(msg) as unknown as BufferSource,
  );
  return bytesToB64Url(new Uint8Array(sig));
}

/** payloadB64.sigB64 — payload is base64url(JSON), sig is HMAC over payloadB64. */
async function signToken(secret: string, payload: object): Promise<string> {
  const payloadB64 = bytesToB64Url(utf8ToBytes(JSON.stringify(payload)));
  const sig = await hmac(secret, payloadB64);
  return `${payloadB64}.${sig}`;
}

async function verifyToken<T>(secret: string, token: string): Promise<T | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(secret, payloadB64);
  // Constant-time compare of the signatures.
  if (!timingSafeEqual(b64UrlToBytes(sig), b64UrlToBytes(expected))) return null;
  let payload: T & { e?: number };
  try {
    payload = JSON.parse(bytesToUtf8(b64UrlToBytes(payloadB64)));
  } catch {
    return null;
  }
  if (typeof payload.e === "number" && payload.e * 1000 < Date.now()) return null;
  return payload as T;
}

// ── session ───────────────────────────────────────────────────────────────────

interface SessionPayload {
  h: string;
  e: number;
}

export function createSessionToken(env: AuthEnv, handle: string): Promise<string> {
  const e = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  return signToken(secretOf(env), { h: handle, e } satisfies SessionPayload);
}

export async function readSession(
  env: AuthEnv,
  request: Request,
): Promise<{ handle: string } | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const payload = await verifyToken<SessionPayload>(secretOf(env), token);
  return payload ? { handle: payload.h } : null;
}

// ── WebAuthn challenge ──────────────────────────────────────────────────────────

export type ChallengePurpose = "reg" | "auth";
interface ChallengePayload {
  c: string; // challenge (base64url)
  p: ChallengePurpose;
  h: string; // handle (may be "" for handle-less assertion)
  e: number;
}

export function randomChallengeB64(): string {
  return bytesToB64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function createChallengeToken(
  env: AuthEnv,
  challengeB64: string,
  purpose: ChallengePurpose,
  handle: string,
): Promise<string> {
  const e = Math.floor(Date.now() / 1000) + CHALLENGE_TTL_S;
  return signToken(secretOf(env), {
    c: challengeB64,
    p: purpose,
    h: handle,
    e,
  } satisfies ChallengePayload);
}

export async function readChallenge(
  env: AuthEnv,
  request: Request,
): Promise<{ challengeB64: string; purpose: ChallengePurpose; handle: string } | null> {
  const token = readCookie(request, CHALLENGE_COOKIE);
  if (!token) return null;
  const p = await verifyToken<ChallengePayload>(secretOf(env), token);
  return p ? { challengeB64: p.c, purpose: p.p, handle: p.h } : null;
}

// ── cookies ───────────────────────────────────────────────────────────────────

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

function setCookie(
  name: string,
  value: string,
  maxAgeS: number,
  secure: boolean,
): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeS}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function sessionCookie(value: string, secure: boolean): string {
  return setCookie(SESSION_COOKIE, value, SESSION_TTL_S, secure);
}
export function challengeCookie(value: string, secure: boolean): string {
  return setCookie(CHALLENGE_COOKIE, value, CHALLENGE_TTL_S, secure);
}
/** Expire a cookie immediately (sign-out / consume challenge). */
export function clearCookie(name: string, secure: boolean): string {
  return setCookie(name, "", 0, secure);
}

// ── request host / origin (forwarded-host aware) ─────────────────────────────────
//
// The app's canonical host (app.px-registry.org) is fronted by the zone router,
// which proxies to the Pages origin. So the Function's own URL/Host may read as
// *.pages.dev while the browser's effective origin is app.px-registry.org. We
// honor X-Forwarded-Host / X-Forwarded-Proto when present, and additionally
// allow the whole px-registry.org family as valid WebAuthn origins, so an
// assertion made on app.px-registry.org verifies regardless of which hop the
// Function sees.

export function effectiveHost(request: Request): string {
  const fwd = request.headers.get("X-Forwarded-Host");
  if (fwd) return fwd.split(",")[0].trim();
  const host = request.headers.get("Host");
  if (host) return host;
  return new URL(request.url).host;
}

function effectiveProto(request: Request): string {
  const fwd = request.headers.get("X-Forwarded-Proto");
  if (fwd) return fwd.split(",")[0].trim();
  return new URL(request.url).protocol.replace(":", "");
}

export function effectiveOrigin(request: Request): string {
  return `${effectiveProto(request)}://${effectiveHost(request)}`;
}

export function isSecureRequest(request: Request): boolean {
  return effectiveProto(request) === "https";
}

export function rpIdFor(request: Request): string {
  return getWebAuthnRpId(effectiveHost(request));
}

/**
 * Origins an assertion is allowed to come from.
 *
 * Always includes the px-registry.org family (apex / app / <handle>), because
 * the zone router proxies app.px-registry.org → *.pages.dev and Cloudflare
 * rewrites the Host on that hop — so the Function cannot infer the brand host
 * from its own request, and effectiveOrigin would read as *.pages.dev. We list
 * the brand family unconditionally (a fixed allowlist of our own hosts) plus the
 * effective origin (which covers a direct *.pages.dev deploy and localhost dev).
 * The expected rpId is still derived per-assertion from the signed, allowlisted
 * clientData.origin in lib/webauthn/verify.ts, so this only widens the origin
 * allowlist to our own domains — it never trusts the request host.
 */
export function allowedOrigins(request: Request, handle?: string): string[] {
  const origins = new Set<string>([
    effectiveOrigin(request),
    `https://${PX_REGISTRY_DOMAIN}`,
    `https://app.${PX_REGISTRY_DOMAIN}`,
  ]);
  if (handle) origins.add(`https://${handle}.${PX_REGISTRY_DOMAIN}`);
  return [...origins];
}

// ── JSON response ───────────────────────────────────────────────────────────────

export function json(
  body: unknown,
  status = 200,
  setCookies: string[] = [],
): Response {
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const c of setCookies) headers.append("Set-Cookie", c);
  return new Response(JSON.stringify(body), { status, headers });
}

export { sha256Hex };
