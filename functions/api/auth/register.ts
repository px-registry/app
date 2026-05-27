// POST /api/auth/register
//
// Step 2 of sign-up. Confirms the challenge cookie was issued for this handle,
// stores the owner record (public key + recovery-code hash — no secret, no PII),
// and sets the session cookie. PX never sees the private key or the plaintext
// recovery code.

import { validateHandle } from "../../../lib/handle/index.ts";
import {
  type AuthEnv,
  type OwnerRecord,
  getOwner,
  putOwner,
  readChallenge,
  createSessionToken,
  sessionCookie,
  clearCookie,
  CHALLENGE_COOKIE,
  isSecureRequest,
  json,
} from "../../_auth.ts";

interface RegisterBody {
  handle?: unknown;
  credential_id?: unknown;
  public_key_jwk?: unknown;
  recovery_code_hash?: unknown;
  display_name?: unknown;
}

function isJwkEc(v: unknown): v is JsonWebKey {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as JsonWebKey).kty === "EC" &&
    (v as JsonWebKey).crv === "P-256"
  );
}

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as RegisterBody;

  const v = validateHandle(body.handle);
  if (!v.valid) {
    return json({ ok: false, error: "Invalid handle." }, 400);
  }
  const handle = v.handle;

  // The challenge cookie proves a registration-challenge was issued for exactly
  // this handle in this browser session, and that it has not expired.
  const chal = await readChallenge(env, request);
  if (!chal || chal.purpose !== "reg" || chal.handle !== handle) {
    return json(
      { ok: false, error: "Registration challenge expired. Please start again." },
      400,
    );
  }

  if (
    typeof body.credential_id !== "string" ||
    !isJwkEc(body.public_key_jwk) ||
    typeof body.recovery_code_hash !== "string" ||
    !/^[0-9a-f]{64}$/.test(body.recovery_code_hash)
  ) {
    return json({ ok: false, error: "Malformed credential." }, 400);
  }

  // Re-check uniqueness at commit time (guards a race between the two steps).
  if (await getOwner(env, handle)) {
    return json(
      { ok: false, reason: "taken", error: "That handle was just taken." },
      409,
    );
  }

  const display_name =
    typeof body.display_name === "string" && body.display_name.trim()
      ? body.display_name.trim().slice(0, 60)
      : undefined;

  const rec: OwnerRecord = {
    handle,
    credential_id: body.credential_id,
    public_key_jwk: body.public_key_jwk,
    recovery_code_hash: body.recovery_code_hash,
    ...(display_name ? { display_name } : {}),
    created_at: new Date().toISOString(),
  };
  await putOwner(env, rec);

  const secure = isSecureRequest(request);
  const session = await createSessionToken(env, handle);
  return json({ ok: true, handle, redirect: "/compose/" }, 200, [
    sessionCookie(session, secure),
    clearCookie(CHALLENGE_COOKIE, secure),
  ]);
};
