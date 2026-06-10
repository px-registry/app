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

export function findModel(id: string): MeetModel {
  return MEET_MODELS.find((m) => m.id === id) ?? MEET_MODELS[0];
}
