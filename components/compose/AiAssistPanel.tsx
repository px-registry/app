"use client";

// AiAssistPanel — the AI連携 tool, adapted from the old px-composer's AI surface.
// The reference's pattern: an AI "draft" assist that turns a photo + a few words
// into proposed listing fields you review before anything is used, configured
// with provider keys held only in this browser. We carry over the part that is
// self-contained and honest today — the configuration and its privacy framing —
// and are plain that live draft generation lands alongside the category
// composers it fills (§2: no over-claim; the reference itself frames AI as a
// reviewed suggestion, never auto-applied).
//
// Keys live in localStorage and are sent directly to the provider, never to PX —
// PX has no AI endpoint and relays nothing here.

import { useEffect, useState } from "react";

type Provider = { id: string; label: string; storeKey: string; placeholder: string };

const PROVIDERS: Provider[] = [
  { id: "openai", label: "OpenAI", storeKey: "pxai:openai", placeholder: "sk-…" },
  { id: "anthropic", label: "Anthropic", storeKey: "pxai:anthropic", placeholder: "sk-ant-…" },
];

const PROFILE_KEY = "pxai:profile";

export function AiAssistPanel({ onPick }: { onPick: (mode: string) => void }) {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState("");
  const [saved, setSaved] = useState(false);

  // Read browser-local config on mount (client only — no SSR access).
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const p of PROVIDERS) next[p.id] = localStorage.getItem(p.storeKey) || "";
    setKeys(next);
    setProfile(localStorage.getItem(PROFILE_KEY) || "");
  }, []);

  function setKey(p: Provider, v: string) {
    setKeys((prev) => ({ ...prev, [p.id]: v }));
    if (v) localStorage.setItem(p.storeKey, v);
    else localStorage.removeItem(p.storeKey);
    flashSaved();
  }
  function saveProfile(v: string) {
    setProfile(v);
    if (v.trim()) localStorage.setItem(PROFILE_KEY, v);
    else localStorage.removeItem(PROFILE_KEY);
    flashSaved();
  }
  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  return (
    <section className="ai-panel">
      <p className="ai-eyebrow" lang="ja">
        AI 連携
      </p>
      <h1 className="ai-h">AI assist</h1>
      <p className="ai-intro">
        Turn a photo and a few words into a draft listing — title, description,
        price — that you review and edit before anything is used. AI is never
        perfect; nothing it proposes is applied without your confirmation.
      </p>

      <div className="ai-keys">
        <p className="ai-section-label">Providers</p>
        <p className="ai-privacy">
          Keys are saved <strong>in this browser only</strong> and sent directly
          to the provider — never to PX. PX has no AI endpoint.
        </p>
        {PROVIDERS.map((p) => (
          <label className="field" key={p.id}>
            <span className="field-label">{p.label} API key</span>
            <input
              className="field-input"
              type="password"
              value={keys[p.id] ?? ""}
              onChange={(e) => setKey(p, e.target.value)}
              placeholder={p.placeholder}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ))}
        <label className="field">
          <span className="field-label">
            Maker profile <span className="field-opt">optional</span>
          </span>
          <textarea
            className="field-input field-area"
            value={profile}
            onChange={(e) => saveProfile(e.target.value)}
            placeholder="A line or two about you and what you make — given to the model as context for better drafts."
            rows={2}
          />
        </label>
        <p className="ai-saved" aria-live="polite">
          {saved ? "Saved to this browser ✓" : " "}
        </p>
      </div>

      <div className="ai-preview">
        <p className="ai-section-label">Draft from a photo</p>
        <p className="ai-preview-tag">Arriving with the category composers</p>
        <p className="ai-preview-body">
          Once a category composer is live, this is where you’ll drop a photo and
          let the assist fill in its fields for you to review. Today the two built
          tools take their input directly:
        </p>
        <div className="ai-preview-picks">
          <button type="button" className="ai-preview-pick" onClick={() => onPick("sale")}>
            List a sale →
          </button>
          <button type="button" className="ai-preview-pick" onClick={() => onPick("pack")}>
            Send a pack →
          </button>
        </div>
      </div>
    </section>
  );
}
