// pack_id — the content-addressed identity of a pack.
//
//   pack_id = SHA-256( JCS-canonical( manifest core ) )
//
// The id is a pure function of the manifest's content. PX cannot assign it;
// anyone can recompute it from the same bytes and get the same answer. That is
// what "verifiable with standard tools" means at the identity layer.

import { canonicalize, type JsonValue } from "./canonical.ts";
import { sha256Hex } from "./hash.ts";
import type { PxManifestCoreV1, PxPackFile } from "./types.ts";

/**
 * Return a copy of a file entry with any `delivery` custody field removed,
 * recursing into nested contents. Identity-only transform: the content keys
 * (name/kind/bytes/sha256/note/contents) are untouched, so a file that never
 * carried delivery canonicalizes byte-for-byte as before.
 */
function fileWithoutDelivery(file: PxPackFile): PxPackFile {
  const { delivery: _d, contents, ...rest } = file as PxPackFile & {
    delivery?: unknown;
  };
  return contents
    ? { ...rest, contents: contents.map(fileWithoutDelivery) }
    : rest;
}

/**
 * Strip everything that is not pack content from a manifest core: the injected
 * `pack_id` (must never be part of its own preimage) and the `delivery` custody
 * metadata (a delivery is *where the bytes are held for 30 days*, not content —
 * attaching or expiring it must not change the content-addressed identity).
 * Today `delivery` only lives on the core, but it is also stripped recursively
 * from files so the rule holds if a per-file delivery is ever added.
 */
export function stripDelivery(
  core: PxManifestCoreV1,
): PxManifestCoreV1 {
  const { pack_id: _ignored, delivery: _delivery, files, ...rest } =
    core as PxManifestCoreV1 & { pack_id?: unknown };
  return files ? { ...rest, files: files.map(fileWithoutDelivery) } : rest;
}

/**
 * Compute the pack_id for a manifest core. The id is the SHA-256 of the JCS
 * canonical form of the *content* core — `pack_id` and `delivery` are excluded
 * (see stripDelivery), so the same files always yield the same id whether or
 * not their bytes were uploaded for delivery.
 */
export async function computePackId(
  core: PxManifestCoreV1,
): Promise<string> {
  return sha256Hex(
    canonicalize(stripDelivery(core) as unknown as JsonValue),
  );
}

/** Default number of leading hex chars used when displaying a pack_id short. */
export const SHORT_ID_LENGTH = 12;

/**
 * Shorten a pack_id for display. The full id stays the canonical identity (in
 * URLs, in the verifiable-record block); the short form is a glanceable handle
 * for chips and headings. 12 hex chars (48 bits) is ample for a human cue.
 */
export function shortId(id: string, length: number = SHORT_ID_LENGTH): string {
  return id.slice(0, length);
}
