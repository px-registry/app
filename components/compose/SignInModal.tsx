"use client";

// SignInModal — the passkey sign-in ceremony as an inline overlay, not a
// navigation. The deferred-auth keystone of the composer dashboard: a visitor
// explores the tools and builds a draft with no account, and only the final
// attribution step (publishing a sale, saving settings) summons this. Because it
// is an overlay over a still-mounted dashboard, the draft underneath is never
// lost — sign in, and the action that asked for it continues.
//
// It runs the same three-step ceremony as the standalone /signin/ page (challenge
// → navigator.credentials assertion → verify), then reads the fresh session so
// the dashboard can fill in the owner's identity. No password ever exists.

import { useEffect, useRef, useState } from "react";
import { assertPasskey, isWebAuthnSupported } from "@/lib/webauthn/index.ts";
import { fetchMe, type MeResponse } from "@/lib/auth-client.ts";

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "assert_cancelled") return "Sign-in was cancelled.";
  if (msg === "passkey_unsupported") return "This browser doesn’t support passkeys.";
  return "Sign-in failed. Please try again.";
}

export function SignInModal({
  open,
  reason,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  /** A short line explaining why sign-in was asked for, shown under the title. */
  reason?: string;
  onClose: () => void;
  onSignedIn: (me: MeResponse) => void;
}) {
  const [handle, setHandle] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the handle field whenever the modal opens; clear transient state.
  useEffect(() => {
    if (open) {
      setError(null);
      setWorking(false);
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const trimmed = handle.trim();

  async function signIn() {
    setError(null);
    if (!trimmed) {
      setError("Enter your handle.");
      return;
    }
    if (!isWebAuthnSupported()) {
      setError("This browser doesn’t support passkeys.");
      return;
    }

    setWorking(true);
    try {
      const cRes = await fetch("/api/auth/assertion-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ handle: trimmed }),
      });
      const cj = await cRes.json();
      if (!cRes.ok || !cj.ok) {
        setError(cj.error || "Could not start sign-in.");
        setWorking(false);
        return;
      }

      const assertion = await assertPasskey({
        challengeB64: cj.challenge_b64,
        allowCredentialIdsB64: cj.allow_credentials,
      });

      const vRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ handle: trimmed, ...assertion }),
      });
      const vj = await vRes.json();
      if (!vRes.ok || !vj.ok) {
        setError(vj.error || "Sign-in failed.");
        setWorking(false);
        return;
      }

      // Read the now-live session so the dashboard gets handle + display name +
      // default category (the verify response carries only a redirect).
      const me = await fetchMe();
      onSignedIn(me);
    } catch (e) {
      setError(friendlyError(e));
      setWorking(false);
    }
  }

  return (
    <div
      className="signin-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !working) onClose();
      }}
    >
      <div className="signin-card">
        <h2 className="signin-h">Sign in to continue</h2>
        <p className="signin-intro">
          {reason ?? "Your handle and passkey — nothing to remember, nothing to phish."}{" "}
          Your draft stays open behind this.
        </p>

        <label className="field">
          <span className="field-label">Handle</span>
          <input
            ref={inputRef}
            className="field-input"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="ito-atelier"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={working}
            onKeyDown={(e) => {
              if (e.key === "Enter") void signIn();
            }}
          />
        </label>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <div className="signin-actions">
          <button
            type="button"
            className="auth-btn"
            onClick={signIn}
            disabled={working || !trimmed}
          >
            {working ? "Waiting for passkey…" : "Sign in with passkey"}
          </button>
          <button
            type="button"
            className="signin-cancel"
            onClick={onClose}
            disabled={working}
          >
            Not now
          </button>
        </div>

        <p className="auth-alt">
          New here? <a href="/signup/">Create an identity →</a>
        </p>
      </div>
    </div>
  );
}
