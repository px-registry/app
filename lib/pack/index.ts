// px.pack — public API.
//
// The verifiable core of PX: a pack's identity is the SHA-256 of the RFC 8785
// canonical form of its manifest. Compute it, shorten it for display, walk a
// chain of them. PX holds none of this — it falls out of the bytes.

export type {
  PxVersion,
  PxKind,
  PxPackFile,
  PxListing,
  PxManifestCoreV1,
  Pack,
} from "./types.ts";
export { isSendAPack } from "./types.ts";

export { canonicalize, type JsonValue } from "./canonical.ts";
export { sha256Hex } from "./hash.ts";
export { computePackId, shortId, SHORT_ID_LENGTH } from "./pack-id.ts";
export { indexById, ancestorsOf, isGenesis } from "./chain.ts";

import { computePackId } from "./pack-id.ts";
import type { Pack, PxManifestCoreV1 } from "./types.ts";

/**
 * Pair each manifest core with its computed pack_id, preserving input order.
 * The single entry point the data layer uses to turn authored manifests into
 * renderable packs.
 */
export async function toPacks(cores: PxManifestCoreV1[]): Promise<Pack[]> {
  return Promise.all(
    cores.map(async (core) => ({ pack_id: await computePackId(core), core })),
  );
}
