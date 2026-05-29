"use client";

// AiAssistPanel — the AI連携 tool, adapted from the old px-composer's AI surface.
// Redesigned per the brief: pick a MODEL first, then the selected provider's
// connection detail appears — an API key for OpenAI/Anthropic, an endpoint for
// Ollama (local, no key). Everything is browser-local and sent straight to the
// provider; PX has no AI endpoint and relays nothing here (持たない).
//
// Live draft generation (Ollama adapter, movable prompt window, photo→fields)
// is the following "AI連携 live" atomic; this atomic ships the configuration and
// its honest framing. Copy is dictionary-sourced.

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/context.tsx";

type ProviderId = "openai" | "anthropic" | "ollama";
type Model = { id: string; provider: ProviderId; label: string };

// Model labels are product identifiers — not translated.
const MODELS: Model[] = [
  { id: "gpt-4o", provider: "openai", label: "GPT-4o" },
  { id: "gpt-4o-mini", provider: "openai", label: "GPT-4o mini" },
  { id: "claude-opus-4-8", provider: "anthropic", label: "Claude Opus 4.8" },
  { id: "claude-sonnet-4-6", provider: "anthropic", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", provider: "anthropic", label: "Claude Haiku 4.5" },
  { id: "ollama:llama3.2-vision", provider: "ollama", label: "Llama 3.2 Vision" },
  { id: "ollama:llava", provider: "ollama", label: "LLaVA (vision)" },
];

const KEY_STORE: Record<"openai" | "anthropic", string> = {
  openai: "pxai:openai",
  anthropic: "pxai:anthropic",
};
const ENDPOINT_STORE = "pxai:ollama-endpoint";
const MODEL_STORE = "pxai:model";
const PROFILE_STORE = "pxai:profile";
const DEFAULT_ENDPOINT = "http://localhost:11434";

const PROVIDER_GROUPS: ProviderId[] = ["openai", "anthropic", "ollama"];

export function AiAssistPanel({ onPick }: { onPick: (mode: string) => void }) {
  const t = useT();
  const [modelId, setModelId] = useState<string>(MODELS[0].id);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [profile, setProfile] = useState("");
  const [saved, setSaved] = useState(false);

  // Read browser-local config on mount (client only).
  useEffect(() => {
    const m = localStorage.getItem(MODEL_STORE);
    if (m && MODELS.some((x) => x.id === m)) setModelId(m);
    setOpenaiKey(localStorage.getItem(KEY_STORE.openai) || "");
    setAnthropicKey(localStorage.getItem(KEY_STORE.anthropic) || "");
    setEndpoint(localStorage.getItem(ENDPOINT_STORE) || "");
    setProfile(localStorage.getItem(PROFILE_STORE) || "");
  }, []);

  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0];
  const provider = model.provider;

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }
  function persist(key: string, value: string) {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
    flashSaved();
  }

  function changeModel(id: string) {
    setModelId(id);
    localStorage.setItem(MODEL_STORE, id);
    flashSaved();
  }
  function changeKey(p: "openai" | "anthropic", v: string) {
    if (p === "openai") setOpenaiKey(v);
    else setAnthropicKey(v);
    persist(KEY_STORE[p], v);
  }
  function changeEndpoint(v: string) {
    setEndpoint(v);
    persist(ENDPOINT_STORE, v);
  }
  function changeProfile(v: string) {
    setProfile(v);
    persist(PROFILE_STORE, v);
  }

  return (
    <section className="ai-panel">
      <h1 className="ai-h">{t("ai.heading")}</h1>
      <p className="ai-intro">{t("ai.intro")}</p>

      <div className="ai-config">
        <label className="field">
          <span className="field-label">{t("ai.model.label")}</span>
          <select
            className="field-input"
            value={modelId}
            onChange={(e) => changeModel(e.target.value)}
          >
            {PROVIDER_GROUPS.map((p) => (
              <optgroup key={p} label={t(`ai.provider.${p}`)}>
                {MODELS.filter((m) => m.provider === p).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        {/* The selected provider's connection detail. */}
        {provider === "ollama" ? (
          <label className="field">
            <span className="field-label">{t("ai.endpoint.label")}</span>
            <input
              className="field-input"
              value={endpoint}
              onChange={(e) => changeEndpoint(e.target.value)}
              placeholder={DEFAULT_ENDPOINT}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="field-help">{t("ai.endpoint.help")}</span>
          </label>
        ) : (
          <label className="field">
            <span className="field-label">
              {t(`ai.provider.${provider}`)} {t("ai.key.label")}
            </span>
            <input
              className="field-input"
              type="password"
              value={provider === "openai" ? openaiKey : anthropicKey}
              onChange={(e) =>
                changeKey(provider as "openai" | "anthropic", e.target.value)
              }
              placeholder={provider === "openai" ? "sk-…" : "sk-ant-…"}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}

        <p className="ai-privacy">{t("ai.privacy")}</p>

        <label className="field">
          <span className="field-label">
            {t("ai.profile.label")}{" "}
            <span className="field-opt">{t("common.optional")}</span>
          </span>
          <textarea
            className="field-input field-area"
            value={profile}
            onChange={(e) => changeProfile(e.target.value)}
            placeholder={t("ai.profile.placeholder")}
            rows={2}
          />
        </label>
        <p className="ai-saved" aria-live="polite">
          {saved ? t("ai.saved") : " "}
        </p>
      </div>

      <div className="ai-preview">
        <p className="ai-section-label">{t("ai.preview.label")}</p>
        <p className="ai-preview-tag">{t("ai.preview.tag")}</p>
        <p className="ai-preview-body">{t("ai.preview.body")}</p>
        <div className="ai-preview-picks">
          <button type="button" className="ai-preview-pick" onClick={() => onPick("sale")}>
            {t("ai.preview.sale")}
          </button>
          <button type="button" className="ai-preview-pick" onClick={() => onPick("pack")}>
            {t("ai.preview.pack")}
          </button>
        </div>
      </div>
    </section>
  );
}
