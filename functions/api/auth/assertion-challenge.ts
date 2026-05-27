// POST /api/auth/assertion-challenge
//
// Step 1 of sign-in. Mints a challenge in a signed cookie. If a (known) handle
// is supplied, returns its credential id in allow_credentials so the browser
// can target the right passkey; omit the handle for discoverable sign-in.

import {
  type AuthEnv,
  getOwner,
  randomChallengeB64,
  createChallengeToken,
  challengeCookie,
  isSecureRequest,
  rpIdFor,
  json,
} from "../../_auth.ts";

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { handle?: unknown };
  const handle = typeof body.handle === "string" ? body.handle.trim() : "";

  const allow_credentials: string[] = [];
  if (handle) {
    const owner = await getOwner(env, handle);
    if (owner) allow_credentials.push(owner.credential_id);
  }

  const challenge = randomChallengeB64();
  const token = await createChallengeToken(env, challenge, "auth", handle);

  return json(
    {
      ok: true,
      challenge_b64: challenge,
      rp_id: rpIdFor(request),
      ...(allow_credentials.length ? { allow_credentials } : {}),
    },
    200,
    [challengeCookie(token, isSecureRequest(request))],
  );
};
