// R1.5 — participantRef derivation, shared by the browser client and the Pages
// Functions (both have WebCrypto). The owner's device-local secret token never
// leaves the device except inside a write request, where the server derives
// this ref and DROPS the token (never stored). The ref is opaque and public;
// writing as a ref requires the secret token that hashes to it.

const REF_BYTES = 8; // 16 hex chars — collision-irrelevant at five participants

export async function deriveParticipantRef(ownerToken: string): Promise<string> {
  const data = new TextEncoder().encode(`px-meet-r15:${ownerToken}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest).slice(0, REF_BYTES);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Shape guard for a ref coming back from the network/URL. */
export function isParticipantRef(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{16}$/.test(s);
}

/** Shape guard for the device-local secret token. */
export function isOwnerToken(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{32,64}$/.test(s);
}

/**
 * R2 0010 — mint an edge id (T1, device-minted). edge_ is the client
 * namespace; r15pair_ is reserved for backfill provenance and refused by the
 * server BY SHAPE, so a client cannot dress an edge up as backfill.
 */
export function mintEdgeId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `edge_${hex}`;
}
