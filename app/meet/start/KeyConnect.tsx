"use client";

// R1.5 step 1 — AIをつなぐ (fix1: one action). Paste a key; the provider is
// detected from its prefix (sk-ant-…→Claude / sk-…→OpenAI) and a good default
// model is chosen internally. The model picker hides behind 詳細. A local
// Ollama lane sits in its own tab (endpoint, no key). Owner-local only
// (pxai:* precedent keys); nothing here talks to PX.

import { useEffect, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import {
  MEET_MODELS,
  PROVIDER_LABELS,
  UNKNOWN_KEY_HINT,
  DEFAULT_OLLAMA_ENDPOINT,
  detectProviderFromKey,
  saveDetectedKey,
  switchToLocalLane,
  getModel,
  setModel,
  getKey,
  getEndpoint,
  isConnected,
} from "@/lib/meet-ai";

const KEY_LINKS = [
  { label: "Claude（Anthropic）", href: "https://console.anthropic.com/" },
  { label: "OpenAI", href: "https://platform.openai.com/api-keys" },
] as const;

export function KeyConnect() {
  const [lane, setLane] = useState<"key" | "local" | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [endpoint, setEndpointState] = useState("");
  const [saved, setSaved] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [connectedLabel, setConnectedLabel] = useState<string | null>(null);
  const [modelId, setModelId] = useState("");

  const refreshConnected = () => {
    setConnectedLabel(isConnected() ? getModel().label : null);
    setModelId(getModel().id);
  };

  useEffect(() => {
    const m = getModel();
    setLane(m.provider === "ollama" ? "local" : "key");
    if (m.provider !== "ollama") setKeyValue(getKey(m.provider));
    setEndpointState(getEndpoint());
    refreshConnected();
  }, []);

  if (lane === null) return null;

  const detected = detectProviderFromKey(keyValue);

  const save = () => {
    setUnknown(false);
    if (lane === "local") {
      switchToLocalLane(endpoint);
    } else {
      const provider = saveDetectedKey(keyValue);
      if (provider === null) {
        setUnknown(true);
        return;
      }
    }
    setSaved(true);
    refreshConnected();
    setTimeout(() => setSaved(false), 1800);
  };

  const pickModel = (id: string) => {
    setModel(id);
    refreshConnected();
  };

  return (
    <div className="m-form">
      <div className="m-kindrow" role="group">
        <button
          type="button"
          className={`m-chip m-chip-pick ${lane === "key" ? "m-chip-active" : ""}`}
          onClick={() => setLane("key")}
        >
          {MEET.connect.tabKey}
        </button>
        <button
          type="button"
          className={`m-chip m-chip-pick ${lane === "local" ? "m-chip-active" : ""}`}
          onClick={() => setLane("local")}
        >
          {MEET.connect.tabLocal}
        </button>
      </div>

      {lane === "key" ? (
        <>
          <label className="m-note">{MEET.connect.keyLabel}</label>
          <input
            className="m-field"
            type="password"
            value={keyValue}
            onChange={(e) => {
              setKeyValue(e.target.value);
              setUnknown(false);
            }}
            placeholder={MEET.connect.keyPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
          {detected !== null && keyValue.trim() !== "" && (
            <p className="m-note" aria-live="polite">
              {MEET.connect.detected(PROVIDER_LABELS[detected])}
            </p>
          )}
          {unknown && (
            <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
              {UNKNOWN_KEY_HINT}
            </p>
          )}
          <p className="m-note">
            {MEET.connect.keyLinksLabel}
            {KEY_LINKS.map((l, i) => (
              <span key={l.href}>
                {i > 0 && " ／ "}
                <a href={l.href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--shu-deep)" }}>
                  {l.label}
                </a>
              </span>
            ))}
          </p>
        </>
      ) : (
        <>
          <label className="m-note">{MEET.connect.endpointLabel}</label>
          <input
            className="m-field"
            value={endpoint}
            onChange={(e) => setEndpointState(e.target.value)}
            placeholder={DEFAULT_OLLAMA_ENDPOINT}
            autoComplete="off"
            spellCheck={false}
          />
        </>
      )}

      <button
        type="button"
        className="m-btn m-btn-quiet"
        style={{ justifySelf: "start", marginTop: "0.4rem" }}
        onClick={save}
      >
        {saved ? MEET.connect.saved : MEET.connect.save}
      </button>
      {connectedLabel !== null && (
        <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
          {MEET.connect.connected(connectedLabel)}
        </p>
      )}
      <p className="m-note">{MEET.connect.privacy}</p>

      <details style={{ marginTop: "0.3rem" }}>
        <summary className="m-note" style={{ cursor: "pointer" }}>
          {MEET.connect.detailsLabel}
        </summary>
        <select
          className="m-field"
          style={{ marginTop: "0.4rem" }}
          value={modelId}
          onChange={(e) => pickModel(e.target.value)}
        >
          {MEET_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </details>
    </div>
  );
}
