// POST /api/auth/registration-challenge
//
// Step 1 of sign-up. Validates the requested handle (format + reserved +
// not-already-taken), mints a WebAuthn challenge, and stashes it in a signed,
// short-lived HttpOnly cookie. Returns what the browser's enroll ceremony needs.

import { validateHandle } from "../../../lib/handle/index.ts";
import { bytesToB64Url } from "../../../lib/webauthn/encoding.ts";
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
  const v = validateHandle(body.handle);
  if (!v.valid) {
    return json(
      {
        ok: false,
        reason: v.reason,
        error:
          v.reason === "reserved"
            ? "That handle is reserved."
            : "That handle isn’t valid (3–32 chars, lowercase letters, digits, hyphens).",
      },
      400,
    );
  }

  if (await getOwner(env, v.handle)) {
    return json(
      { ok: false, reason: "taken", error: "That handle is already taken." },
      409,
    );
  }

  const challenge = randomChallengeB64();
  const userId = bytesToB64Url(crypto.getRandomValues(new Uint8Array(16)));
  const token = await createChallengeToken(env, challenge, "reg", v.handle);

  return json(
    {
      ok: true,
      challenge_b64: challenge,
      user_id_b64: userId,
      rp_id: rpIdFor(request),
    },
    200,
    [challengeCookie(token, isSecureRequest(request))],
  );
};
