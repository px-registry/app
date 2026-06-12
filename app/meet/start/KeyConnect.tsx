"use client";

// R1.5 step 1 — AIをつなぐ (fix1: one action). Paste a key; the provider is
// detected from its prefix (sk-ant-…→Claude / sk-…→OpenAI) and a good default
// model is chosen internally. The model picker hides behind 詳細.
//
// Local lane (Ollama): PROBE-DRIVEN honesty — 「つながっています」 appears only
// after /api/tags actually answered, and the model picker offers exactly the
// models installed on the owner's machine (nothing hardcoded). Unreachable /
// empty states say so plainly.

import { useCallback, useEffect, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import {
  MEET_MODELS,
  PROVIDER_LABELS,
  UNKNOWN_KEY_HINT,
  OLLAMA_UNREACHABLE,
  OLLAMA_NO_MODELS,
  OLLAMA_MODELS_LABEL,
  DEFAULT_OLLAMA_ENDPOINT,
  detectProviderFromKey,
  saveDetectedKey,
  switchToLocalLane,
  probeOllama,
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

type LocalProbe =
  | { phase: "probing" }
  | { phase: "ok"; models: string[] }
  | { phase: "unreachable" };

export function KeyConnect() {
  const [lane, setLane] = useState<"key" | "local" | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [endpoint, setEndpointState] = useState("");
  const [saved, setSaved] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [keyConnectedLabel, setKeyConnectedLabel] = useState<string | null>(null);
  const [modelId, setModelId] = useState("");
  const [local, setLocal] = useState<LocalProbe>({ phase: "probing" });

  const refreshKeyConnected = () => {
    const m = getModel();
    setKeyConnectedLabel(m.provider !== "ollama" && isConnected() ? m.label : null);
    setModelId(m.id);
  };

  const probeLocal = useCallback(async (ep: string) => {
    setLocal({ phase: "probing" });
    const r = await probeOllama(ep);
    if (!r.ok) {
      setLocal({ phase: "unreachable" });
      return;
    }
    setLocal({ phase: "ok", models: r.models });
    // Point the model at what actually exists: keep the stored choice when
    // installed, else take the first installed model.
    if (r.models.length > 0) {
      const current = getModel();
      const currentName = current.provider === "ollama" ? current.id.slice("ollama:".length) : "";
      const chosen = r.models.includes(currentName) ? currentName : r.models[0];
      setModel(`ollama:${chosen}`);
      setModelId(`ollama:${chosen}`);
    }
  }, []);

  useEffect(() => {
    const m = getModel();
    const startLane = m.provider === "ollama" ? "local" : "key";
    setLane(startLane);
    if (m.provider !== "ollama") setKeyValue(getKey(m.provider));
    setEndpointState(getEndpoint());
    refreshKeyConnected();
    if (startLane === "local") void probeLocal(getEndpoint());
  }, [probeLocal]);

  if (lane === null) return null;

  const detected = detectProviderFromKey(keyValue);

  const switchLane = (next: "key" | "local") => {
    setLane(next);
    if (next === "local") void probeLocal(endpoint);
  };

  const save = () => {
    setUnknown(false);
    if (lane === "local") {
      switchToLocalLane(endpoint);
      void probeLocal(endpoint);
    } else {
      const provider = saveDetectedKey(keyValue);
      if (provider === null) {
        setUnknown(true);
        return;
      }
      refreshKeyConnected();
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const pickLocalModel = (name: string) => {
    setModel(`ollama:${name}`);
    setModelId(`ollama:${name}`);
  };

  const pickKeyModel = (id: string) => {
    setModel(id);
    refreshKeyConnected();
  };

  const localModelName = modelId.startsWith("ollama:") ? modelId.slice("ollama:".length) : "";

  return (
    <div className="m-form">
      <div className="m-kindrow" role="group">
        <button
          type="button"
          className={`m-chip m-chip-pick ${lane === "key" ? "m-chip-active" : ""}`}
          onClick={() => switchLane("key")}
        >
          {MEET.connect.tabKey}
        </button>
        <button
          type="button"
          className={`m-chip m-chip-pick ${lane === "local" ? "m-chip-active" : ""}`}
          onClick={() => switchLane("local")}
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
          <button
            type="button"
            className="m-btn m-btn-quiet"
            style={{ justifySelf: "start", marginTop: "0.4rem" }}
            onClick={save}
          >
            {saved ? MEET.connect.saved : MEET.connect.save}
          </button>
          {keyConnectedLabel !== null && (
            <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
              {MEET.connect.connected(keyConnectedLabel)}
            </p>
          )}
          <details style={{ marginTop: "0.3rem" }}>
            <summary className="m-note" style={{ cursor: "pointer" }}>
              {MEET.connect.detailsLabel}
            </summary>
            <select
              className="m-field"
              style={{ marginTop: "0.4rem" }}
              value={modelId}
              onChange={(e) => pickKeyModel(e.target.value)}
            >
              {MEET_MODELS.filter((m) => m.provider !== "ollama").map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </details>
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
          <button
            type="button"
            className="m-btn m-btn-quiet"
            style={{ justifySelf: "start", marginTop: "0.4rem" }}
            onClick={save}
          >
            {saved ? MEET.connect.saved : MEET.connect.save}
          </button>
          {local.phase === "unreachable" && (
            <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
              {OLLAMA_UNREACHABLE}
            </p>
          )}
          {local.phase === "ok" && local.models.length === 0 && (
            <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
              {OLLAMA_NO_MODELS}
            </p>
          )}
          {local.phase === "ok" && local.models.length > 0 && (
            <>
              <label className="m-note">{OLLAMA_MODELS_LABEL}</label>
              <select
                className="m-field"
                value={localModelName}
                onChange={(e) => pickLocalModel(e.target.value)}
              >
                {local.models.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
                {MEET.connect.connected(`Ollama（${localModelName}）`)}
              </p>
            </>
          )}
        </>
      )}

      <p className="m-note">{MEET.connect.privacy}</p>
    </div>
  );
}
