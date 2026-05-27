"use client";

// Sign-in: enter your handle, then prove possession of your passkey. The server
// hands out a challenge, the authenticator signs it, the server verifies the
// signature against the stored public key. No password ever exists to phish.

import { useState } from "react";
import { assertPasskey, isWebAuthnSupported } from "@/lib/webauthn/index.ts";

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "assert_cancelled") return "Sign-in was cancelled.";
  if (msg === "passkey_unsupported") return "This browser doesn’t support passkeys.";
  return "Sign-in failed. Please try again.";
}

export function SignIn() {
  const [handle, setHandle] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      window.location.href = vj.redirect || "/me/";
    } catch (e) {
      setError(friendlyError(e));
      setWorking(false);
    }
  }

  return (
    <section className="auth">
      <h1 className="auth-h">Sign in</h1>
      <p className="auth-intro">
        Enter your handle and use your passkey. Nothing to remember, nothing to
        phish.
      </p>

      <label className="field">
        <span className="field-label">Handle</span>
        <input
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

      <button
        type="button"
        className="auth-btn"
        onClick={signIn}
        disabled={working || !trimmed}
      >
        {working ? "Waiting for passkey…" : "Sign in with passkey"}
      </button>

      <p className="auth-alt">
        New here? <a href="/signup/">Create an identity →</a>
      </p>
    </section>
  );
}
