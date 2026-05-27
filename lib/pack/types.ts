// px.pack — manifest types (v1).
//
// A pack is a small, content-addressed record of owner-domain activity. Its
// identity is the pack_id: the SHA-256 of the RFC 8785 (JCS) canonical form of
// the manifest core. Because the id is derived from the content, it cannot be
// minted by PX — it falls out of the bytes. PX holds nothing; the manifest is
// self-describing and verifiable with standard tools.
//
// Two shapes share one core:
//   • listing form    — a public-register entry pointing at owner activity
//   • send-a-pack form — a file delivery (the .pack viewer / B2B wedge)
// The discriminator is which payload is present (`listing` vs `files`).

/** Manifest format version. */
export type PxVersion = "1.0";

/** Manifest kind. Only px.pack today. */
export type PxKind = "px.pack";

/**
 * One file inside a send-a-pack delivery. `note` carries the sender's
 * per-file annotation ("read this first", "what changed", …) — the human
 * layer that makes a delivery legible without a covering email.
 *
 * `bytes` / `sha256` are optional: a manifest can describe a delivery whose
 * payload lives elsewhere. When present, `sha256` is the lowercase hex
 * SHA-256 of the file content (content addressing all the way down).
 */
export interface PxPackFile {
  name: string;
  bytes?: number;
  sha256?: string;
  note?: string;
}

/**
 * Listing-form payload: a public-register entry. These are the fields a
 * category page and a listing detail render. They describe activity that
 * lives on the owner's own domain — PX points at it, it does not host it.
 *
 * `fact` is the one category-shaped fact (time left, availability, progress,
 * stream state, …). Kept as a flat string map so the manifest stays simple
 * and the canonical form stays stable across categories.
 */
export interface PxListing {
  title: string;
  /** Owner handle, e.g. "Ito Atelier". */
  sender: string;
  /** Owner domain the activity lives on, e.g. "ito-atelier.example". */
  domain: string;
  /** Short human label for the kind of entry, e.g. "Auction", "Wanted". */
  type: string;
  description: string;
  fact?: Record<string, string>;
}

/**
 * The manifest core — the exact object that gets canonicalized and hashed to
 * produce the pack_id. It MUST NOT contain the pack_id itself (the id is a
 * function of everything else; including it would be circular).
 *
 * `category` is one of the eight owner-domain activity categories (slug). It
 * is typed as string here to keep lib/pack free of app-layer imports; the
 * data layer constrains it to the known set.
 *
 * `previous` is the pack_id of the prior link in a chain (a newsletter's last
 * issue, a manuscript's prior revision). Absent on a genesis pack.
 */
export interface PxManifestCoreV1 {
  px: PxVersion;
  kind: PxKind;
  /** ISO 8601 UTC instant the pack was created. */
  created_at: string;
  category: string;
  note?: string;
  listing?: PxListing;
  files?: PxPackFile[];
  previous?: string;
}

/**
 * A manifest core paired with its derived pack_id. This is what the app
 * renders: the id is computed at build time from the core, never authored.
 */
export interface Pack {
  pack_id: string;
  core: PxManifestCoreV1;
}

/** True when a pack carries a file delivery (send-a-pack form). */
export function isSendAPack(core: PxManifestCoreV1): boolean {
  return Array.isArray(core.files) && core.files.length > 0;
}
