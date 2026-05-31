// Attested Board — opaque public-safe identifiers.
//
// Transaction events, declarations, and SERVER-MINTED board records are
// referenced from public responses and from BoardRecordV1.receiptRefs, so their
// ids must be public-safe and non-reversible: a random opaque token, never
// derived from the owner's auth identity, email, or any private handle.
// crypto.getRandomValues is available in both the Workers runtime and Node.
//
// "rec" is the prefix the owner-publish lane mints for a new board record
// (server-side, never body-provided) — the same opaque, non-reversible shape, so
// record_id leaks nothing about the owning auth identity (req 12 / req 18).

const PREFIXES = ["evt", "dec", "rec"] as const;
export type OpaqueIdPrefix = (typeof PREFIXES)[number];

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * A fresh opaque id: `<prefix>_<22 base64url chars of 16 random bytes>`. The
 * randomness is the whole point — the id carries no owner-identifying material,
 * so it cannot be reversed to an account, email, or auth handle (§4).
 */
export function newOpaqueId(prefix: OpaqueIdPrefix): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${prefix}_${toB64Url(bytes)}`;
}

/** Shape check for an opaque id (used by reject tests; not a security boundary). */
export function isOpaqueId(s: unknown, prefix?: OpaqueIdPrefix): boolean {
  if (typeof s !== "string") return false;
  const m = /^([a-z]+)_([A-Za-z0-9_-]{16,})$/.exec(s);
  if (!m) return false;
  return prefix ? m[1] === prefix : (PREFIXES as readonly string[]).includes(m[1]);
}
