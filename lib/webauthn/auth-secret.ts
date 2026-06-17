// Auth HMAC secret resolution — pure, shared by functions/_auth.ts and node tests.
//
// SECURITY (Hiroto gate 2026-06-17): production MUST fail-closed when AUTH_SECRET
// is absent. The insecure DEV_SECRET fallback is allowed ONLY when an explicit
// local/dev marker (ALLOW_DEV_SECRET=1, set in .dev.vars — never a production
// secret) is present. If neither is set, this returns null and the caller rejects
// (no session can be minted or verified). Falling back to a known DEV_SECRET in
// production would let anyone forge a session and collapse the passkey identity
// root the whole Device Mesh trust chain sits on.

/** The insecure local-dev secret. Worthless off a dev box: only used when
 *  ALLOW_DEV_SECRET=1 AND no AUTH_SECRET is set. */
export const DEV_SECRET = "px-dev-insecure-secret-set-AUTH_SECRET-in-prod";

export interface AuthSecretEnv {
  AUTH_SECRET?: string;
  /** "1" only in local/dev (.dev.vars). Absent in production → fail-closed. */
  ALLOW_DEV_SECRET?: string;
}

/**
 * The HMAC secret for session/challenge tokens, or null to fail-closed.
 * - AUTH_SECRET set (non-empty) → use it (production / configured dev).
 * - else ALLOW_DEV_SECRET="1" → DEV_SECRET (explicit local/dev only).
 * - else → null (production with no secret = reject everything).
 */
export function resolveAuthSecret(env: AuthSecretEnv): string | null {
  if (typeof env.AUTH_SECRET === "string" && env.AUTH_SECRET.length > 0) return env.AUTH_SECRET;
  if (env.ALLOW_DEV_SECRET === "1") return DEV_SECRET;
  return null;
}
