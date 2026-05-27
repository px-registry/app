"use client";

// Minimal owner profile. Handle is read-only (it is the identity); display name
// and default category are editable and saved to the owner's KV record. Gated
// client-side like /me/.

import { useEffect, useState } from "react";
import { fetchMe } from "@/lib/auth-client.ts";
import { categories } from "@/app/categories";

type Save = "idle" | "saving" | "saved" | "error";

export function Settings() {
  const [handle, setHandle] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [defaultCategory, setDefaultCategory] = useState("");
  const [save, setSave] = useState<Save>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchMe().then((m) => {
      if (!live) return;
      if (!m.signed_in) {
        window.location.replace("/signin/");
        return;
      }
      setHandle(m.handle ?? "");
      setDisplayName(m.display_name ?? "");
      setDefaultCategory(m.default_category ?? "");
    });
    return () => {
      live = false;
    };
  }, []);

  async function persist() {
    setSave("saving");
    setError(null);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          display_name: displayName,
          default_category: defaultCategory,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        setError(j.error || "Could not save.");
        setSave("error");
        return;
      }
      setSave("saved");
      setTimeout(() => setSave("idle"), 1800);
    } catch {
      setError("Could not save.");
      setSave("error");
    }
  }

  if (handle === null) {
    return <p className="auth-intro">Loading…</p>;
  }

  return (
    <section className="auth">
      <h1 className="auth-h">Settings</h1>

      <label className="field">
        <span className="field-label">Handle</span>
        <input className="field-input" value={handle} readOnly disabled />
        <span className="field-opt">
          Your handle is permanent — it is your identity.
        </span>
      </label>

      <label className="field">
        <span className="field-label">
          Display name <span className="field-opt">optional</span>
        </span>
        <input
          className="field-input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Itō Atelier"
          disabled={save === "saving"}
        />
      </label>

      <label className="field">
        <span className="field-label">
          Default category <span className="field-opt">optional</span>
        </span>
        <select
          className="field-input"
          value={defaultCategory}
          onChange={(e) => setDefaultCategory(e.target.value)}
          disabled={save === "saving"}
        >
          <option value="">No default</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="auth-btn"
        onClick={persist}
        disabled={save === "saving"}
      >
        {save === "saving" ? "Saving…" : save === "saved" ? "Saved ✓" : "Save"}
      </button>
    </section>
  );
}
