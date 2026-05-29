"use client";

// Header auth indicator — a single restrained chip in the top-right, on every
// page (mounted from the root layout). Signed out: a quiet "Sign in" link.
// Signed in: "@handle ●" — a link to the owner surface, which now lives inline
// in the composer's 設定 tab (no floating popover; that depended on the Popover
// API and misbehaved where it isn't fully supported).
//
// Renders null until the session is known, so every page's static HTML stays
// free of auth chrome (sealed pages untouched at build time).

import { useEffect, useState } from "react";
import { fetchMe, type MeResponse } from "@/lib/auth-client.ts";

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
  // inline sign-in modal), so this badge stops being stale.
  useEffect(() => {
    const refresh = () => fetchMe().then((m) => setMe(m));
    window.addEventListener("px:session-changed", refresh);
    return () => window.removeEventListener("px:session-changed", refresh);
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
    <div className="auth-badge">
      <a className="auth-handle" href="/compose/?mode=settings" title="Your settings">
        <span className="auth-dot" aria-hidden />@{me.handle}
      </a>
    </div>
  );
}
