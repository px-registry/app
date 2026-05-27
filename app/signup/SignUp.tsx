"use client";

// Sign-up: claim a handle, create a passkey, save a recovery code.
//
// What PX ends up holding: handle → public key + recovery-code hash. No
// password, no email, no private key. The recovery code is generated on this
// device and shown exactly once; only its hash is sent. We articulate this
// honestly — the public key and handle association *are* held by PX.

import { useState } from "react";
import { validateHandle } from "@/lib/handle/index.ts";
import {
  enrollPasskey,
  isWebAuthnSupported,
  generateRecoveryCode,
  recoveryCodeHash,
} from "@/lib/webauthn/index.ts";

type Status = "idle" | "working" | "done";

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "enroll_cancelled") return "Passkey creation was cancelled.";
  if (msg === "passkey_unsupported" || msg === "passkey_legacy_ua")
    return "This browser can’t create passkeys.";
  return "Something went wrong. Please try again.";
}

export function SignUp() {
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const trimmed = handle.trim();
  const v = validateHandle(trimmed);
  const showHandleHint = trimmed.length > 0 && !v.valid;

  async function register() {
    setError(null);
    const valid = validateHandle(handle);
    if (!valid.valid) {
      setError(
        valid.reason === "reserved"
          ? "That handle is reserved."
          : "Handle must be 3–32 chars: lowercase letters, digits, hyphens.",
      );
      return;
    }
    if (!isWebAuthnSupported()) {
      setError("This browser doesn’t support passkeys.");
      return;
    }

    setStatus("working");
    try {
      const cRes = await fetch("/api/auth/registration-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ handle: valid.handle }),
      });
      const cj = await cRes.json();
      if (!cRes.ok || !cj.ok) {
        setError(cj.error || "Could not start registration.");
        setStatus("idle");
        return;
      }

      const enrolled = await enrollPasskey({
        handle: valid.handle,
        challengeB64: cj.challenge_b64,
        userIdB64: cj.user_id_b64,
        displayName,
      });

      const code = generateRecoveryCode();
      const hash = await recoveryCodeHash(code);

      const rRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          handle: valid.handle,
          credential_id: enrolled.credential_id,
          public_key_jwk: enrolled.public_key_jwk,
          recovery_code_hash: hash,
          display_name: displayName.trim() || undefined,
        }),
      });
      const rj = await rRes.json();
      if (!rRes.ok || !rj.ok) {
        setError(rj.error || "Registration failed.");
        setStatus("idle");
        return;
      }

      setRecoveryCode(code);
      setStatus("done");
    } catch (e) {
      setError(friendlyError(e));
      setStatus("idle");
    }
  }

  async function copyCode() {
    if (!recoveryCode) return;
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* selectable in the field */
    }
  }

  if (status === "done" && recoveryCode) {
    return (
      <section className="auth">
        <h1 className="auth-h">Save your recovery code</h1>
        <p className="auth-intro">
          You’re registered as{" "}
          <span className="signedin-handle">@{trimmed}</span>. This recovery code
          is shown <strong>once</strong>. Store it somewhere safe — it’s the only
          way back in if you lose your passkey. PX keeps only a hash of it and can
          never show it to you again.
        </p>
        <div className="recovery-box">
          <code className="recovery-code">{recoveryCode}</code>
          <button type="button" className="share-copy" onClick={copyCode}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <label className="auth-check">
          <input
            type="checkbox"
            checked={saved}
            onChange={(e) => setSaved(e.target.checked)}
          />
          <span>I’ve saved my recovery code somewhere safe.</span>
        </label>
        <a
          className={`auth-btn${saved ? "" : " is-disabled"}`}
          href={saved ? "/compose/" : undefined}
          aria-disabled={!saved}
          onClick={(e) => {
            if (!saved) e.preventDefault();
          }}
        >
          Continue →
        </a>
      </section>
    );
  }

  return (
    <section className="auth">
      <h1 className="auth-h">Create your PX identity</h1>
      <p className="auth-intro">
        Claim a handle and create a passkey. No password, no email — PX holds a
        public key and your handle, nothing more. Your handle becomes{" "}
        <span className="auth-mono">
          {trimmed ? trimmed : "yourhandle"}.px-registry.org
        </span>
        .
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
          disabled={status === "working"}
        />
      </label>
      {showHandleHint && (
        <p className="auth-hint-bad">
          {v.valid === false && v.reason === "reserved"
            ? "That handle is reserved."
            : "3–32 chars: lowercase letters, digits, single hyphens."}
        </p>
      )}

      <label className="field">
        <span className="field-label">
          Display name <span className="field-opt">optional</span>
        </span>
        <input
          className="field-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Itō Atelier"
          disabled={status === "working"}
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
        onClick={register}
        disabled={status === "working" || !v.valid}
      >
        {status === "working" ? "Creating passkey…" : "Register passkey"}
      </button>

      <p className="auth-alt">
        Already have a passkey? <a href="/signin/">Sign in →</a>
      </p>
    </section>
  );
}
