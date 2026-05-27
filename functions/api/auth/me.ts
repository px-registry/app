// GET /api/auth/me
//
// The signed-in surface's source of truth: validates the session cookie and
// returns the owner's handle + profile fields, or { signed_in: false }. Used by
// the header badge, the /me/ pages, and the composer's auto-fill.

import { type AuthEnv, readSession, getOwner, json } from "../../_auth.ts";

export const onRequestGet: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const session = await readSession(env, request);
  if (!session) return json({ signed_in: false });

  const owner = await getOwner(env, session.handle);
  if (!owner) return json({ signed_in: false }); // stale session (record gone)

  return json({
    signed_in: true,
    handle: owner.handle,
    display_name: owner.display_name ?? null,
    default_category: owner.default_category ?? null,
  });
};
