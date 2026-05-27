// Share-link codec — unicode-safe base64url for the manifest core.
//
// A metadata-only share carries the whole manifest (file list, notes, content
// hashes — never the bytes) in the URL fragment, so opening it rebuilds the
// receiver's view with no server in the loop. The fragment never leaves the
// browser, so PX receives nothing even on a metadata-only share.

import type { PxManifestCoreV1 } from "@/lib/pack/index.ts";

export function encodeManifest(core: PxManifestCoreV1): string {
  const bytes = new TextEncoder().encode(JSON.stringify(core));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeManifest(encoded: string): PxManifestCoreV1 {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as PxManifestCoreV1;
}
