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
 * One entry in a send-a-pack delivery. An entry is either a leaf file or a
 * container (a dropped folder, or an expanded archive) carrying nested
 * `contents`. `note` carries the sender's per-entry annotation ("read this
 * first", "what changed", …) — the human layer that makes a delivery legible
 * without a covering email; it applies to leaves and containers alike.
 *
 * `bytes` / `sha256` are optional: a manifest can describe a delivery whose
 * payload lives elsewhere. When present, `sha256` is the lowercase hex
 * SHA-256 of the file content (content addressing all the way down). Container
 * entries usually omit them (the hashes live on the leaves inside).
 *
 * For a nested entry, `name` is its path relative to the container, using the
 * normalized separator `/` (see normalizePath). The structure is recursive:
 * `contents` holds the same type, so folders nest arbitrarily deep — and the
 * canonicalizer hashes them deterministically because it recurses too.
 */
export interface PxPackFile {
  name: string;
  /** "file" (leaf, default) | "folder" | "archive" (an expanded .zip). */
  kind?: "file" | "folder" | "archive";
  bytes?: number;
  sha256?: string;
  note?: string;
  contents?: PxPackFile[];
}

/**
 * Where a send-a-pack's file bytes are temporarily held for download, and when
 * that custody expires. PX relays the bytes into delivery storage (R2), holds
 * them for a fixed window (30 days), then they are deleted. PX never reads the
 * contents — it only streams them through.
 *
 * This field is attached AFTER the pack_id is computed and is excluded from the
 * pack_id preimage (see computePackId / stripDelivery): a delivery is custody
 * metadata, not content. Attaching it — or its expiring — never changes a
 * pack's content-addressed identity, so a delivery can be added to an existing
 * pack without minting a new id, and the same files always hash the same way
 * whether or not bytes were uploaded.
 *
 * `base` is an absolute URL ending in "/"; a file's download URL is
 * `base + <its pack-relative path, each segment URI-encoded>`. The pack-relative
 * path is the file's `name` for a top-level leaf, or `<container name>/<name>`
 * for a file nested inside a folder/archive. `expires_at` is the ISO 8601
 * instant after which the bytes are gone (informational — the deletion is
 * enforced by the storage lifecycle rule, not by this string).
 *
 * It lives on the manifest core rather than per-file because every file in one
 * send-a-pack shares a single storage prefix and a single 30-day window, and a
 * shared base keeps the manifest small enough to ride in the share-link URL.
 */
export interface PxDelivery {
  base: string;
  expires_at: string;
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
  /** Optional prose blurb. A send-a-pack leans on its cover note instead. */
  description?: string;
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
  /**
   * Optional delivery custody (send-a-pack only). EXCLUDED from the pack_id —
   * see PxDelivery and computePackId. Absent on every listing pack and on any
   * send-a-pack whose bytes were not uploaded (a metadata-only share link).
   */
  delivery?: PxDelivery;
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

/** True when a pack's bytes are (or were) held for download — `delivery` set. */
export function hasDelivery(core: PxManifestCoreV1): boolean {
  return typeof core.delivery?.base === "string";
}

/** True when an entry is a container (folder/archive) with nested contents. */
export function isContainer(file: PxPackFile): boolean {
  return Array.isArray(file.contents);
}
