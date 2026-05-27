// pack_id — the content-addressed identity of a pack.
//
//   pack_id = SHA-256( JCS-canonical( manifest core ) )
//
// The id is a pure function of the manifest's content. PX cannot assign it;
// anyone can recompute it from the same bytes and get the same answer. That is
// what "verifiable with standard tools" means at the identity layer.

import { canonicalize, type JsonValue } from "./canonical.ts";
import { sha256Hex } from "./hash.ts";
import type { PxManifestCoreV1 } from "./types.ts";

/**
 * Compute the pack_id for a manifest core.
 *
 * Defensive: if a `pack_id` key somehow rides along on the object, it is
 * stripped before hashing — the id must never be part of its own preimage.
 */
export async function computePackId(
  core: PxManifestCoreV1,
): Promise<string> {
  const { pack_id: _ignored, ...preimage } = core as PxManifestCoreV1 & {
    pack_id?: unknown;
  };
  return sha256Hex(canonicalize(preimage as unknown as JsonValue));
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
