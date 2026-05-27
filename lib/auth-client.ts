// Client-side auth helpers (browser only). Thin wrappers over the auth
// Functions: read the current session, and sign out. The sign-up / sign-in
// ceremonies live in their page components because they orchestrate the
// WebAuthn calls; this module is the shared read path used by the header badge,
// the /me/ pages, and the composer auto-fill.

export interface MeResponse {
  signed_in: boolean;
  handle?: string;
  display_name?: string | null;
  default_category?: string | null;
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
