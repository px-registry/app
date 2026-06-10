// R1.5 meet AI — model catalog (lineage: components/compose/AiAssistPanel.tsx).
// Model labels are product identifiers — not translated. The default favors
// proposal quality; the owner can change it any time.

export type ProviderId = "anthropic" | "openai" | "ollama";

export type MeetModel = { id: string; provider: ProviderId; label: string };

export const MEET_MODELS: readonly MeetModel[] = [
  { id: "claude-sonnet-4-6", provider: "anthropic", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4-8", provider: "anthropic", label: "Claude Opus 4.8" },
  { id: "claude-haiku-4-5", provider: "anthropic", label: "Claude Haiku 4.5" },
  { id: "gpt-4o", provider: "openai", label: "GPT-4o" },
  { id: "gpt-4o-mini", provider: "openai", label: "GPT-4o mini" },
  { id: "ollama:llama3.2", provider: "ollama", label: "Ollama（自分のPC）" },
];

export const DEFAULT_MODEL_ID = MEET_MODELS[0].id;

/** Per-provider default — good quality without asking the owner to choose.
 *  (fix1: the model picker is hidden behind 詳細; these are what you get.) */
export const DEFAULT_BY_PROVIDER: Record<ProviderId, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  ollama: "ollama:llama3.2",
};

export function findModel(id: string): MeetModel {
  return MEET_MODELS.find((m) => m.id === id) ?? MEET_MODELS[0];
}

/** Provider label for the 「…につながります」 line. */
export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Claude（Anthropic）",
  openai: "OpenAI",
  ollama: "Ollama",
};

/** Provider-naming copy lives HERE (the meet label layer is provider-blind —
 *  gate M-3b — but a key hint has to name what it recognizes). */
export const UNKNOWN_KEY_HINT =
  "この鍵の形はまだ知りません。sk-ant-…（Claude）か sk-…（OpenAI）の鍵を貼ってください。";

/**
 * fix1: detect the provider from the key's prefix so the owner never picks one.
 * sk-ant-… → Anthropic; other sk-… → OpenAI; anything else → null (unknown).
 */
export function detectProviderFromKey(key: string): "anthropic" | "openai" | null {
  const k = key.trim();
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("sk-")) return "openai";
  return null;
}
