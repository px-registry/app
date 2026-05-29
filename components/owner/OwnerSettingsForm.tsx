"use client";

// OwnerSettingsForm — the owner's two persisted settings (display name, default
// category) plus the save round-trip to /api/auth/profile. Extracted so the two
// places that show these settings — the OwnerPopover (summoned from the corner
// badge) and the composer's 設定 tool (SettingsPanel) — render one form and
// cannot drift. It owns its own field + save state; `onDisplayNameChange` lets a
// host mirror the display name elsewhere (the popover card's name) without
// lifting all the state up.

import { useState } from "react";
import { categories } from "@/app/categories";

type Save = "idle" | "saving" | "saved" | "error";

export function OwnerSettingsForm({
  initialDisplayName,
  initialCategory,
  onDisplayNameChange,
}: {
  initialDisplayName: string;
  initialCategory: string;
  onDisplayNameChange?: (v: string) => void;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [category, setCategory] = useState(initialCategory);
  const [save, setSave] = useState<Save>("idle");

  function changeDisplayName(v: string) {
    setDisplayName(v);
    onDisplayNameChange?.(v);
  }

  async function persist() {
    setSave("saving");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ display_name: displayName, default_category: category }),
      });
      const j = await res.json();
      setSave(res.ok && j.ok ? "saved" : "error");
      if (res.ok && j.ok) setTimeout(() => setSave("idle"), 1600);
    } catch {
      setSave("error");
    }
  }

  return (
    <div className="owner-settings">
      <label className="field">
        <span className="field-label">
          Display name <span className="field-opt">optional</span>
        </span>
        <input
          className="field-input"
          value={displayName}
          onChange={(e) => changeDisplayName(e.target.value)}
          placeholder="Itō Atelier"
        />
      </label>
      <label className="field">
        <span className="field-label">
          Default category <span className="field-opt">optional</span>
        </span>
        <select
          className="field-input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">No default</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="auth-btn" onClick={persist} disabled={save === "saving"}>
        {save === "saving" ? "Saving…" : save === "saved" ? "Saved ✓" : "Save"}
      </button>
      {save === "error" && (
        <p className="auth-error" role="alert">
          Could not save.
        </p>
      )}
    </div>
  );
}
