"use client";

// Header auth indicator — a single, restrained chip in the top-right, present on
// every page (mounted from the root layout). Signed out: a quiet "Sign in" link.
// Signed in: "@handle ●" with a soft green dot (the Worker:OK pattern), linking
// to /me/. It only reflects state; it never gates anything (§2 Brand Spirit:
// auth is an optional unlock, not a wall).

import { useEffect, useState } from "react";
import { fetchMe, type MeResponse } from "@/lib/auth-client.ts";

export function AuthBadge() {
  // null = not yet known (render nothing to avoid a flash / hydration mismatch).
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

  // Until the session is known, render nothing — this keeps the static HTML of
  // every page free of auth chrome (the chip is injected only after client
  // hydration), so existing content pages are untouched at build time.
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
      <a className="auth-handle" href="/me/" title="Your identity">
        <span className="auth-dot" aria-hidden />@{me.handle}
      </a>
    </div>
  );
}
