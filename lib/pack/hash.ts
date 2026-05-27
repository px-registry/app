// SHA-256 via the Web Crypto API.
//
// `crypto.subtle` is a global in browsers, in Node (≥ the version this project
// targets), and in the Workers runtime — one implementation, every surface.
// The digest API is async, so callers await; pack_id computation is a
// build-time step for static export, so the cost is paid once.

/** Lowercase hex SHA-256 of a UTF-8 string or raw bytes. */
export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  // `bytes` is a BufferSource at runtime; the cast quiets the lib's
  // ArrayBufferLike-vs-ArrayBuffer union (a SharedArrayBuffer can never reach
  // here — TextEncoder output and our callers are plain ArrayBuffer-backed).
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}
