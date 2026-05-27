// POST /api/auth/verify
//
// Step 2 of sign-in. Looks up the handle's stored public key, confirms the
// presented credential id matches, checks the challenge cookie, and verifies the
// assertion signature with Web Crypto (lib/webauthn/verify). On success, sets the
// session cookie.

import { verifyAssertion } from "../../../lib/webauthn/verify.ts";
import {
  type AuthEnv,
  getOwner,
  readChallenge,
  createSessionToken,
  sessionCookie,
  clearCookie,
  CHALLENGE_COOKIE,
  isSecureRequest,
  allowedOrigins,
  json,
} from "../../_auth.ts";

interface VerifyBody {
  handle?: unknown;
  credential_id?: unknown;
  client_data_json_b64?: unknown;
  authenticator_data_b64?: unknown;
  signature_b64?: unknown;
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as VerifyBody;

  if (
    typeof body.handle !== "string" ||
    typeof body.credential_id !== "string" ||
    typeof body.client_data_json_b64 !== "string" ||
    typeof body.authenticator_data_b64 !== "string" ||
    typeof body.signature_b64 !== "string"
  ) {
    return json({ ok: false, error: "Malformed assertion." }, 400);
  }
  const handle = body.handle.trim();

  const owner = await getOwner(env, handle);
  if (!owner) {
    return json({ ok: false, error: "Sign-in failed." }, 401);
  }
  if (owner.credential_id !== body.credential_id) {
    return json({ ok: false, error: "Sign-in failed." }, 401);
  }

  // The challenge cookie must be an auth challenge from this session. It may be
  // bound to this handle, or handle-less (discoverable sign-in).
  const chal = await readChallenge(env, request);
  if (!chal || chal.purpose !== "auth" || (chal.handle && chal.handle !== handle)) {
    return json(
      { ok: false, error: "Sign-in challenge expired. Please try again." },
      400,
    );
  }

  const res = await verifyAssertion({
    publicKeyJwk: owner.public_key_jwk,
    clientDataJsonB64: body.client_data_json_b64,
    authenticatorDataB64: body.authenticator_data_b64,
    signatureB64: body.signature_b64,
    expectedChallengeB64: chal.challengeB64,
    allowedOrigins: allowedOrigins(request, handle),
  });
  if (!res.ok) {
    return json({ ok: false, error: "Sign-in failed.", reason: res.reason }, 401);
  }

  const secure = isSecureRequest(request);
  const session = await createSessionToken(env, handle);
  return json({ ok: true, handle, redirect: "/compose/" }, 200, [
    sessionCookie(session, secure),
    clearCookie(CHALLENGE_COOKIE, secure),
  ]);
};
