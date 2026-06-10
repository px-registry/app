// R1.5 meet AI — owner-local connection config (browser only). The ONLY file in
// lib/meet-ai that touches localStorage (gate-pinned).
//
// Precedent: components/compose/AiAssistPanel.tsx — the SAME pxai:* keys are
// reused, so a key entered in either surface works in both. Everything is
// browser-local and sent straight to the provider with the owner's own
// credential; PX has no AI endpoint and relays nothing (持たない). STOP #2
// decision includes keys: owner-local persistence, cleared by the owner.

import {
  DEFAULT_MODEL_ID,
  DEFAULT_BY_PROVIDER,
  MEET_MODELS,
  findModel,
  detectProviderFromKey,
  type MeetModel,
} from "./models.ts";

const KEY_STORE: Record<"openai" | "anthropic", string> = {
  openai: "pxai:openai",
  anthropic: "pxai:anthropic",
};
const ENDPOINT_STORE = "pxai:ollama-endpoint";
const MODEL_STORE = "pxmeet:model";

export const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";

export function getModel(): MeetModel {
  const id = localStorage.getItem(MODEL_STORE) ?? "";
  // Catalog ids AND dynamic ollama:<installed-model> ids are both valid —
  // findModel resolves the latter on the fly (an empty ollama name falls back).
  if (id !== "" && (MEET_MODELS.some((m) => m.id === id) || id.startsWith("ollama:"))) {
    return findModel(id);
  }
  return findModel(DEFAULT_MODEL_ID);
}
export function setModel(id: string): void {
  localStorage.setItem(MODEL_STORE, id);
}

export function getKey(provider: "openai" | "anthropic"): string {
  return localStorage.getItem(KEY_STORE[provider]) ?? "";
}
export function setKey(provider: "openai" | "anthropic", value: string): void {
  if (value) localStorage.setItem(KEY_STORE[provider], value);
  else localStorage.removeItem(KEY_STORE[provider]);
}

export function getEndpoint(): string {
  return localStorage.getItem(ENDPOINT_STORE) ?? "";
}
export function setEndpoint(value: string): void {
  if (value) localStorage.setItem(ENDPOINT_STORE, value);
  else localStorage.removeItem(ENDPOINT_STORE);
}

/** Is the currently selected model ready to call? */
export function isConnected(): boolean {
  const m = getModel();
  if (m.provider === "ollama") return true; // endpoint has a default
  return getKey(m.provider).trim().length > 0;
}

/**
 * fix1 one-action connect: detect the provider from the key prefix, store the
 * key, and point the current model at that provider's default (unless the
 * owner already picked a model of the same provider in 詳細). Returns the
 * detected provider, or null when the key shape is unknown (nothing stored).
 */
export function saveDetectedKey(key: string): "anthropic" | "openai" | null {
  const provider = detectProviderFromKey(key);
  if (provider === null) return null;
  setKey(provider, key.trim());
  if (getModel().provider !== provider) {
    setModel(DEFAULT_BY_PROVIDER[provider]);
  }
  return provider;
}

/** fix1: switch to the local lane (Ollama) with its default model. */
export function switchToLocalLane(endpoint: string): void {
  setEndpoint(endpoint.trim());
  if (getModel().provider !== "ollama") {
    setModel(DEFAULT_BY_PROVIDER.ollama);
  }
}
