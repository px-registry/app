// Enroll ceremony (client-only) — navigator.credentials.create wrapper.
//
// ES256 platform passkey: residentKey "preferred" (so the credential can be
// discoverable for conditional sign-in later), attestation "none" (we want no
// device-identifying data — consistent with PX holding as little as possible).
// We export the public key as a JWK with key_ops ["verify"]; the server
// re-imports with the same usage, and Web Crypto refuses a JWK whose key_ops is
// incompatible with the requested usage, so the usages must match.

import { ES256, type EnrollResult } from "./types.ts";
import { bytesToB64Url, b64UrlToBytes, utf8ToBytes } from "./encoding.ts";
import { getWebAuthnRpId } from "./rp.ts";

export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    !!(window.navigator && window.navigator.credentials)
  );
}

export interface EnrollInput {
  handle: string;
  /** base64url challenge issued by /api/auth/registration-challenge. */
  challengeB64: string;
  /** base64url user id issued by the same endpoint. */
  userIdB64: string;
  /** Display name to show in the authenticator UI (falls back to the handle). */
  displayName?: string;
}

export async function enrollPasskey(input: EnrollInput): Promise<EnrollResult> {
  if (!isWebAuthnSupported()) throw new Error("passkey_unsupported");
  const rpId = getWebAuthnRpId(window.location.hostname);
  const options: CredentialCreationOptions = {
    publicKey: {
      rp: { id: rpId, name: "PX Registry" },
      user: {
        id: b64UrlToBytes(input.userIdB64) as unknown as BufferSource,
        name: input.handle,
        displayName: input.displayName?.trim() || input.handle,
      },
      challenge: b64UrlToBytes(input.challengeB64) as unknown as BufferSource,
      pubKeyCredParams: [{ type: "public-key", alg: ES256 }],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  };

  const cred = (await navigator.credentials.create(options)) as PublicKeyCredential | null;
  if (!cred) throw new Error("enroll_cancelled");
  const att = cred.response as AuthenticatorAttestationResponse;

  // Modern browsers expose getPublicKey() returning SPKI bytes directly. If the
  // UA lacks it we surface a clean error rather than attempt COSE parsing.
  if (typeof att.getPublicKey !== "function") throw new Error("passkey_legacy_ua");
  const spki = att.getPublicKey();
  if (!spki) throw new Error("public_key_unavailable");

  const imported = await crypto.subtle.importKey(
    "spki",
    spki,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", imported);

  return {
    credential_id: bytesToB64Url(new Uint8Array(cred.rawId)),
    public_key_jwk: jwk,
  };
}

// Re-export utf8ToBytes so callers that build the user.id need not import the
// encoding module separately.
export { utf8ToBytes };
