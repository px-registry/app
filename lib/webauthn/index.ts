// lib/webauthn — passkey ceremony (client) + assertion verification (server).
//
// PX holds only a public key and a handle association: no secret key, no PII.
// Enrollment and assertion happen in the browser (navigator.credentials); the
// server stores the public key (JWK) and verifies signatures with Web Crypto.
//
// NOTE for Pages Functions: import the server pieces from their specific modules
// (./verify.ts, ./encoding.ts) rather than this barrel — enroll.ts / assert.ts
// reference browser-only globals and have no place in a Worker bundle.

export { ES256 } from "./types.ts";
export type {
  EnrollResult,
  AssertResult,
  VerifyParams,
  VerifyResult,
  VerifyFailure,
} from "./types.ts";

export {
  bytesToB64Url,
  b64UrlToBytes,
  utf8ToBytes,
  bytesToUtf8,
  sha256Bytes,
  sha256Hex,
  timingSafeEqual,
} from "./encoding.ts";

export { getWebAuthnRpId } from "./rp.ts";
export { isWebAuthnSupported, enrollPasskey, type EnrollInput } from "./enroll.ts";
export { assertPasskey, type AssertInput } from "./assert.ts";
export {
  generateRecoveryCode,
  recoveryCodeHash,
  RECOVERY_ALPHABET,
} from "./recovery.ts";
export { verifyAssertion, derToRaw } from "./verify.ts";
