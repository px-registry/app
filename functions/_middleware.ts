// Invite-first gate — HTTP Basic Auth across the whole site (controlled beta).
//
// A root _middleware runs for EVERY request (pages + static assets + Functions),
// so this gates the entire deployment. It is FAIL-CLOSED: if the gate credentials
// are not configured as Pages secrets (BETA_USER / BETA_PASS), every request is
// denied with 401 — an accidental deploy without the secret locks the site rather
// than exposing it. Only an exact credential match passes through.
//
// This is a site-access gate, not owner identity (that is WebAuthn, separate). It
// holds no PII and stores nothing; the browser caches the credential per origin.

interface Env {
  BETA_USER?: string;
  BETA_PASS?: string;
}

const REALM = "PX invite beta";

function unauthorized(): Response {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Constant-time compare — no early-out on the credential bytes. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;
  const user = env.BETA_USER;
  const pass = env.BETA_PASS;

  // Fail-closed: no credentials configured → deny everything.
  if (!user || !pass) return unauthorized();

  const header = request.headers.get("Authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return unauthorized();
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return unauthorized();

  // Compare BOTH fields (no per-field early-out): a mismatch on either fails.
  const okUser = safeEqual(decoded.slice(0, idx), user);
  const okPass = safeEqual(decoded.slice(idx + 1), pass);
  if (!okUser || !okPass) return unauthorized();

  return next();
};
