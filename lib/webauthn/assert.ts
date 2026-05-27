// Assert ceremony (client-only) — navigator.credentials.get wrapper.
//
// Returns the four artifacts the server verifier needs. `allowCredentials`, when
// given, narrows the authenticator to a known credential id (handle-first
// sign-in); omitting it enables discoverable-credential / conditional sign-in.

import { isWebAuthnSupported } from "./enroll.ts";
import { bytesToB64Url, b64UrlToBytes } from "./encoding.ts";
import { getWebAuthnRpId } from "./rp.ts";
import type { AssertResult } from "./types.ts";

export interface AssertInput {
  /** base64url challenge issued by /api/auth/assertion-challenge. */
  challengeB64: string;
  /** base64url credential id(s) to allow; empty/omitted = discoverable. */
  allowCredentialIdsB64?: string[];
}

export async function assertPasskey(input: AssertInput): Promise<AssertResult> {
  if (!isWebAuthnSupported()) throw new Error("passkey_unsupported");
  const rpId = getWebAuthnRpId(window.location.hostname);

  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge: b64UrlToBytes(input.challengeB64) as unknown as BufferSource,
    rpId,
    timeout: 60_000,
    userVerification: "preferred",
  };
  const ids = input.allowCredentialIdsB64 ?? [];
  if (ids.length > 0) {
    publicKey.allowCredentials = ids.map((id) => ({
      type: "public-key" as const,
      id: b64UrlToBytes(id) as unknown as BufferSource,
    }));
  }

  const cred = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential | null;
  if (!cred) throw new Error("assert_cancelled");
  const r = cred.response as AuthenticatorAssertionResponse;

  return {
    credential_id: bytesToB64Url(new Uint8Array(cred.rawId)),
    client_data_json_b64: bytesToB64Url(new Uint8Array(r.clientDataJSON)),
    authenticator_data_b64: bytesToB64Url(new Uint8Array(r.authenticatorData)),
    signature_b64: bytesToB64Url(new Uint8Array(r.signature)),
  };
}
