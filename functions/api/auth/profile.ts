// POST /api/auth/profile
//
// Update the signed-in owner's editable profile fields (display name, default
// category). Handle and credential are immutable here. Requires a valid session.

import {
  type AuthEnv,
  readSession,
  getOwner,
  putOwner,
  json,
} from "../../_auth.ts";

// Mirrors the slugs in app/categories.ts. Kept as a literal here because the
// Functions bundle must not import the React app layer; the settings dropdown is
// populated from the app side and constrained to this same set.
const CATEGORY_SLUGS = new Set([
  "auction",
  "crowdfund",
  "matching",
  "music",
  "sale",
  "service",
  "video",
  "writing",
]);

interface ProfileBody {
  display_name?: unknown;
  default_category?: unknown;
}

// Strip ASCII control characters (U+0000–U+001F and U+007F) from a display name.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

export const onRequestPost: PagesFunction<AuthEnv> = async ({ request, env }) => {
  const session = await readSession(env, request);
  if (!session) return json({ ok: false, error: "Not signed in." }, 401);

  const owner = await getOwner(env, session.handle);
  if (!owner) return json({ ok: false, error: "Not signed in." }, 401);

  const body = (await request.json().catch(() => ({}))) as ProfileBody;

  // display_name: drop control chars, trim, cap length. Empty clears it.
  if (body.display_name !== undefined) {
    if (typeof body.display_name !== "string") {
      return json({ ok: false, error: "Invalid display name." }, 400);
    }
    const cleaned = body.display_name.replace(CONTROL_CHARS, "").trim().slice(0, 60);
    owner.display_name = cleaned || undefined;
  }

  // default_category: must be a known slug, or empty to clear.
  if (body.default_category !== undefined) {
    if (typeof body.default_category !== "string") {
      return json({ ok: false, error: "Invalid category." }, 400);
    }
    const c = body.default_category.trim();
    if (c && !CATEGORY_SLUGS.has(c)) {
      return json({ ok: false, error: "Unknown category." }, 400);
    }
    owner.default_category = c || undefined;
  }

  await putOwner(env, owner);
  return json({
    ok: true,
    handle: owner.handle,
    display_name: owner.display_name ?? null,
    default_category: owner.default_category ?? null,
  });
};
