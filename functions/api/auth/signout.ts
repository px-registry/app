// POST /api/auth/signout
//
// Clears the session cookie. Stateless sessions mean there is nothing to revoke
// server-side beyond expiring the cookie.

import {
  type AuthEnv,
  SESSION_COOKIE,
  clearCookie,
  isSecureRequest,
  json,
} from "../../_auth.ts";

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request }) => {
  return json({ ok: true }, 200, [
    clearCookie(SESSION_COOKIE, isSecureRequest(request)),
  ]);
};
