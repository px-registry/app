"use client";

// The signed-in home. Client-side gated (static export has no server session at
// render time): on mount it reads /api/auth/me and redirects to /signin/ if
// there is no session. The sub-navigation is a deliberately small placeholder —
// the Mode-2 dashboard lands here in a later phase.

import { useEffect, useState } from "react";
import { fetchMe, signOut, type MeResponse } from "@/lib/auth-client.ts";

export function MeHome() {
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    let live = true;
    fetchMe().then((m) => {
      if (!live) return;
      if (!m.signed_in) {
        window.location.replace("/signin/");
        return;
      }
      setMe(m);
    });
    return () => {
      live = false;
    };
  }, []);

  async function doSignOut() {
    await signOut();
    window.location.href = "/";
  }

  if (!me || !me.signed_in) {
    return <p className="auth-intro">Checking your session…</p>;
  }

  return (
    <section className="auth">
      <p className="me-eyebrow">Signed in as</p>
      <h1 className="auth-h">
        <span className="signedin-handle">@{me.handle}</span>
      </h1>
      {me.display_name && <p className="me-display">{me.display_name}</p>}
      <p className="auth-intro">
        Your handle is{" "}
        <span className="auth-mono">{me.handle}.px-registry.org</span>. PX holds a
        public key and this handle — no password, no personal information.
      </p>

      <nav className="me-nav" aria-label="Your identity">
        <a className="me-nav-item" href="/me/compose/">
          <span className="me-nav-title">Compose</span>
          <span className="me-nav-sub">
            Send a pack — sender and domain pre-filled. More composers soon.
          </span>
        </a>
        <a className="me-nav-item" href="/me/settings/">
          <span className="me-nav-title">Settings</span>
          <span className="me-nav-sub">Display name, default category.</span>
        </a>
        <span className="me-nav-item is-soon" aria-disabled>
          <span className="me-nav-title">Activity</span>
          <span className="me-nav-sub">Your published activity — coming soon.</span>
        </span>
      </nav>

      <button type="button" className="auth-signout" onClick={doSignOut}>
        Sign out
      </button>
    </section>
  );
}
