"use client";

// R1.5 step 1 — AIをつなぐ. One small widget: pick a model, paste the key.
// Owner-local only (pxai:* precedent keys, shared with the compose surface);
// nothing here talks to PX.

import { useEffect, useState } from "react";
import { MEET } from "@/lib/meet/copy.ts";
import {
  MEET_MODELS,
  DEFAULT_OLLAMA_ENDPOINT,
  getModel,
  setModel,
  getKey,
  setKey,
  getEndpoint,
  setEndpoint,
  isConnected,
  type MeetModel,
} from "@/lib/meet-ai";

export function KeyConnect() {
  const [model, setModelState] = useState<MeetModel | null>(null);
  const [keyValue, setKeyValue] = useState("");
  const [endpoint, setEndpointState] = useState("");
  const [saved, setSaved] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const m = getModel();
    setModelState(m);
    if (m.provider !== "ollama") setKeyValue(getKey(m.provider));
    setEndpointState(getEndpoint());
    setConnected(isConnected());
  }, []);

  if (model === null) return null;

  const flash = () => {
    setSaved(true);
    setConnected(isConnected());
    setTimeout(() => setSaved(false), 1800);
  };

  const changeModel = (id: string) => {
    setModel(id);
    const m = getModel();
    setModelState(m);
    if (m.provider !== "ollama") setKeyValue(getKey(m.provider));
    setConnected(isConnected());
  };

  const saveKey = () => {
    if (model.provider === "ollama") {
      setEndpoint(endpoint.trim());
    } else {
      setKey(model.provider, keyValue.trim());
    }
    flash();
  };

  return (
    <div className="m-form">
      <label className="m-note">{MEET.connect.modelLabel}</label>
      <select className="m-field" value={model.id} onChange={(e) => changeModel(e.target.value)}>
        {MEET_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      {model.provider === "ollama" ? (
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
      ) : (
        <>
          <label className="m-note">{MEET.connect.keyLabel}</label>
          <input
            className="m-field"
            type="password"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder={model.provider === "openai" ? "sk-…" : "sk-ant-…"}
            autoComplete="off"
            spellCheck={false}
          />
        </>
      )}

      <button
        type="button"
        className="m-btn m-btn-quiet"
        style={{ justifySelf: "start", marginTop: "0.4rem" }}
        onClick={saveKey}
      >
        {saved ? MEET.connect.saved : MEET.connect.save}
      </button>
      {connected && (
        <p className="m-note" aria-live="polite" style={{ color: "var(--shu-deep)" }}>
          {MEET.connect.connected}
        </p>
      )}
      <p className="m-note">{MEET.connect.privacy}</p>
    </div>
  );
}
