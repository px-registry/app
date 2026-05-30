// Attested Board — ownerPublicRef policy.
//
// ownerPublicRef is a PUBLIC display label and must be non-reversible to the
// owner's auth identity (GPT 7.3, carried from A1). It is enforced by test, not
// convention: anything that looks like an email, an auth/credential handle, a
// UUID, or a private id is rejected, so such a value can never slip into a public
// record (which would be a leak). Human display labels — "Ito Atelier ·
// ito-atelier.example" — pass.
//
// "Non-reversible to auth identity": you cannot recover the account/credential
// from this label. (Not a claim about real-world identity.)

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
// A private/credential-shaped token: our auth handles ("auth:…", "handle:…"),
// or a long bare hex / base64url blob with no spacing (credential/local ids).
const PRIVATE_PREFIX = /^(auth:|handle:|cred|session:|local:)/i;
const HEX_BLOB = /^[0-9a-f]{24,}$/i;
const B64_BLOB = /^[A-Za-z0-9_-]{24,}$/;

/** True if the label is safe to expose publicly (non-reversible to auth id). */
export function isPublicSafeOwnerRef(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (!s || s.length > 120) return false;
  if (EMAIL.test(s)) return false;
  if (UUID.test(s)) return false;
  if (PRIVATE_PREFIX.test(s)) return false;
  // A bare, space-free blob is credential-shaped; a human label has spacing or
  // punctuation. Require some non-[A-Za-z0-9_-] separator OR a short length.
  if (HEX_BLOB.test(s)) return false;
  if (B64_BLOB.test(s) && !/[\s.·,/()]/.test(s)) return false;
  return true;
}

/** Throw if a label is not public-safe — the write-path guard for declarations. */
export function assertPublicSafeOwnerRef(value: unknown): string {
  if (!isPublicSafeOwnerRef(value)) {
    throw new Error("ownerPublicRef is not public-safe");
  }
  return value.trim();
}
