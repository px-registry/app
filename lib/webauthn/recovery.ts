// Recovery code — generated entirely client-side on enroll, so the plaintext
// never leaves the device. The server receives only its SHA-256 hash; it can
// confirm a presented code but can never reproduce or display one. This holds
// the PX invariant: PX stores an association (handle → public key + a hash),
// never a secret.
//
// Alphabet mirrors the px-box recovery generator (A–Z minus I/O/L, 2–9 minus
// 0/1) so any server-issued replacement looks and feels the same to the owner.

import { sha256Hex } from "./encoding.ts";

export const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 12 random bytes → "XXXX-XXXX-XXXX" over the recovery alphabet. */
export function generateRecoveryCode(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += RECOVERY_ALPHABET[bytes[g * 4 + i] % RECOVERY_ALPHABET.length];
    }
    groups.push(s);
  }
  return groups.join("-");
}

/** SHA-256 (lowercase hex) of a recovery code — the only form the server keeps. */
export function recoveryCodeHash(code: string): Promise<string> {
  return sha256Hex(code.trim().toUpperCase());
}
