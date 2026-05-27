// WebAuthn wire shapes shared by the client ceremony and the server verifier.
// Everything crosses the wire as base64url strings (suffix `_b64`) or plain
// JWK; raw bytes never appear in JSON.

/** ES256 (P-256 ECDSA) — alg -7. The only algorithm we enroll or verify. */
export const ES256 = -7;

/** Result of a successful enroll ceremony, sent to /api/auth/register. */
export interface EnrollResult {
  /** base64url of the credential rawId. */
  credential_id: string;
  /** Public key as a JWK (kty EC, crv P-256), key_ops ["verify"]. */
  public_key_jwk: JsonWebKey;
}

/** Result of an assert ceremony, sent to /api/auth/verify. */
export interface AssertResult {
  credential_id: string;
  client_data_json_b64: string;
  authenticator_data_b64: string;
  signature_b64: string;
}

/** What the server checks an assertion against. */
export interface VerifyParams {
  /** The stored credential's public key (JWK). */
  publicKeyJwk: JsonWebKey;
  /** base64url clientDataJSON from the assertion. */
  clientDataJsonB64: string;
  /** base64url authenticatorData from the assertion. */
  authenticatorDataB64: string;
  /** base64url (DER) ECDSA signature from the assertion. */
  signatureB64: string;
  /** The challenge the server issued (base64url), to match against clientData. */
  expectedChallengeB64: string;
  /**
   * Allowed origins (e.g. ["https://app.px-registry.org"]). The expected rpId is
   * derived from the (validated) clientData.origin — not from the request host —
   * so verification is correct even when a proxy hides the original Host.
   */
  allowedOrigins: string[];
}

export type VerifyFailure =
  | "bad_client_data"
  | "wrong_type"
  | "challenge_mismatch"
  | "origin_mismatch"
  | "rp_id_mismatch"
  | "user_not_present"
  | "bad_signature_encoding"
  | "signature_invalid";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: VerifyFailure };
