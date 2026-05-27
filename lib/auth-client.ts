// Client-side auth helpers (browser only). Thin wrappers over the auth
// Functions: read the current session, and sign out. The sign-up / sign-in
// ceremonies live in their page components because they orchestrate the
// WebAuthn calls; this module is the shared read path used by the header badge,
// the /me/ pages, and the composer auto-fill.

import { PX_REGISTRY_DOMAIN } from "./handle/index.ts";

export interface MeResponse {
  signed_in: boolean;
  handle?: string;
  display_name?: string | null;
  default_category?: string | null;
}

/** Owner identity used to pre-fill the composer (sender/domain). */
export interface ComposerIdentity {
  handle: string;
  sender: string;
  domain: string;
}

/**
 * Map an authenticated /api/auth/me response to the composer's identity, or
 * null when signed out. The single source of the (display_name||handle,
 * <handle>.px-registry.org) derivation — shared by Mode 1 (/compose/pack/) and
 * Mode 2 (/me/compose/) so they cannot drift.
 */
export function toComposerIdentity(me: MeResponse): ComposerIdentity | null {
  if (!me.signed_in || !me.handle) return null;
  return {
    handle: me.handle,
    sender: me.display_name?.trim() || me.handle,
    domain: `${me.handle}.${PX_REGISTRY_DOMAIN}`,
  };
}

/** GET /api/auth/me — never throws; a failed/absent session reads as signed-out. */
export async function fetchMe(): Promise<MeResponse> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!res.ok) return { signed_in: false };
    return (await res.json()) as MeResponse;
  } catch {
    return { signed_in: false };
  }
}

/** POST /api/auth/signout — clears the session cookie. */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/signout", {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    /* best-effort; the cookie expires regardless */
  }
}
