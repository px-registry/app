"use client";

// Header auth indicator — a single restrained chip in the top-right, on every
// page (mounted from the root layout). Signed out: a quiet "Sign in" link.
// Signed in: "@handle ●" — now a button that summons the OwnerPopover (identity
// as substrate, not a destination). The same popover is also opened by the
// composer rail via a global "px:open-owner" event, so there is one owner
// surface, reachable from anywhere, with no /me/ page.
//
// Renders null until the session is known, so every page's static HTML stays
// free of auth chrome (sealed pages untouched at build time).

import { useEffect, useState } from "react";
import { fetchMe, type MeResponse } from "@/lib/auth-client.ts";
import { OwnerPopover, OWNER_POPOVER_ID } from "@/components/owner/OwnerPopover.tsx";

export function AuthBadge() {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let live = true;
    fetchMe().then((m) => {
      if (live) setMe(m);
    });
    return () => {
      live = false;
    };
  }, []);

  // Re-read the session when something signs in out-of-band (the composer's
  // inline sign-in modal), so this badge and its popover stop being stale.
  useEffect(() => {
    const refresh = () => fetchMe().then((m) => setMe(m));
    window.addEventListener("px:session-changed", refresh);
    return () => window.removeEventListener("px:session-changed", refresh);
  }, []);

  // Let the composer rail (or anything) open the same popover.
  useEffect(() => {
    const open = () => {
      const el = document.getElementById(OWNER_POPOVER_ID) as
        | (HTMLElement & { showPopover?: () => void })
        | null;
      try {
        el?.showPopover?.();
      } catch {
        /* already open — ignore */
      }
    };
    window.addEventListener("px:open-owner", open);
    return () => window.removeEventListener("px:open-owner", open);
  }, []);

  if (me === null) return null;

  if (!me.signed_in) {
    return (
      <div className="auth-badge">
        <a className="auth-signin" href="/signin/">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="auth-badge">
        <button
          type="button"
          className="auth-handle"
          popoverTarget={OWNER_POPOVER_ID}
          title="Your identity"
        >
          <span className="auth-dot" aria-hidden />@{me.handle}
        </button>
      </div>
      <OwnerPopover me={me} />
    </>
  );
}
