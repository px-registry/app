// R1.5 — device-local identity (browser only). The ONLY file in lib/meet-net
// that touches localStorage (gate-pinned). The owner token is a random secret
// minted on first use; it identifies this owner's writes to the meet Functions
// and never appears in any public surface (the server derives an opaque
// participantRef from it and stores only the ref).

const TOKEN_KEY = "pxmeet:owner-token";

export function getOrMintOwnerToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing && /^[0-9a-f]{32,64}$/.test(existing)) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  localStorage.setItem(TOKEN_KEY, hex);
  return hex;
}

/** Forget this device's identity (端末の作り直し). Owner-local only. */
export function clearOwnerToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
