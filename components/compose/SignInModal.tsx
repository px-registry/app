"use client";

// SignInModal — the passkey sign-in ceremony as an inline overlay, not a
// navigation. The deferred-auth keystone of the composer dashboard: a visitor
// explores tools and builds a draft with no account, and only the final
// attributable step (publishing a sale, saving settings) summons this. Because
// it overlays a still-mounted dashboard, the draft underneath is never lost —
// sign in, and the action that asked for it continues.
//
// Same three-step ceremony as the standalone /signin/ page (challenge →
// navigator.credentials assertion → verify), then read the fresh session so the
// dashboard can fill in the owner's identity. Copy is dictionary-sourced.

import { useEffect, useRef, useState } from "react";
import { assertPasskey, isWebAuthnSupported } from "@/lib/webauthn/index.ts";
import { fetchMe, type MeResponse } from "@/lib/auth-client.ts";
import { useT } from "@/lib/i18n/context.tsx";

function errorKey(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "assert_cancelled") return "signin.errCancelled";
  if (msg === "passkey_unsupported") return "signin.errUnsupported";
  return "signin.errGeneric";
}

export function SignInModal({
  open,
  reasonKey = "signin.reasonDefault",
  onClose,
  onSignedIn,
}: {
  open: boolean;
  /** Dictionary key for the line explaining why sign-in was asked for. */
  reasonKey?: string;
  onClose: () => void;
  onSignedIn: (me: MeResponse) => void;
}) {
  const t = useT();
  const [handle, setHandle] = useState("");
  const [working, setWorking] = useState(false);
  // `error` holds a dictionary key (or a server-sent message, shown as-is).
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setWorking(false);
      const tm = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(tm);
    }
  }, [open]);

  if (!open) return null;

  const trimmed = handle.trim();

  // Render an error: known dictionary keys translate; a server message (not a
  // key) is shown verbatim.
  const errorText = error
    ? error.startsWith("signin.")
      ? t(error)
      : error
    : null;

  async function signIn() {
    setError(null);
    if (!trimmed) {
      setError("signin.errHandle");
      return;
    }
    if (!isWebAuthnSupported()) {
      setError("signin.errUnsupported");
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
        setError(cj.error || "signin.errStart");
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
        setError(vj.error || "signin.errFailed");
        setWorking(false);
        return;
      }

      const me = await fetchMe();
      onSignedIn(me);
    } catch (e) {
      setError(errorKey(e));
      setWorking(false);
    }
  }

  return (
    <div
      className="signin-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("signin.title")}
      onClick={(e) => {
        if (e.target === e.currentTarget && !working) onClose();
      }}
    >
      <div className="signin-card">
        <h2 className="signin-h">{t("signin.title")}</h2>
        <p className="signin-intro">
          {t(reasonKey)} {t("signin.draftNote")}
        </p>

        <label className="field">
          <span className="field-label">{t("signin.handle")}</span>
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

        {errorText && (
          <p className="auth-error" role="alert">
            {errorText}
          </p>
        )}

        <div className="signin-actions">
          <button
            type="button"
            className="auth-btn"
            onClick={signIn}
            disabled={working || !trimmed}
          >
            {working ? t("signin.submitWorking") : t("signin.submit")}
          </button>
          <button
            type="button"
            className="signin-cancel"
            onClick={onClose}
            disabled={working}
          >
            {t("signin.cancel")}
          </button>
        </div>

        <p className="auth-alt">
          {t("signin.altNew")} <a href="/signup/">{t("signin.altCreate")}</a>
        </p>
      </div>
    </div>
  );
}
