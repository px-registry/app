// R1.5 meet AI lane — barrel. app/meet imports ONLY from here; the gates pin
// fetch to generate.ts and localStorage to keys.ts.

export {
  MEET_MODELS,
  DEFAULT_MODEL_ID,
  DEFAULT_BY_PROVIDER,
  PROVIDER_LABELS,
  UNKNOWN_KEY_HINT,
  OLLAMA_UNREACHABLE,
  OLLAMA_NO_MODELS,
  OLLAMA_MODELS_LABEL,
  findModel,
  detectProviderFromKey,
  type MeetModel,
  type ProviderId,
} from "./models.ts";
export {
  getModel,
  setModel,
  getKey,
  setKey,
  getEndpoint,
  setEndpoint,
  isConnected,
  saveDetectedKey,
  switchToLocalLane,
  DEFAULT_OLLAMA_ENDPOINT,
} from "./keys.ts";
export {
  buildMeetPrompt,
  toRigPool,
  parseProposalReply,
  parseReplyOutcome,
  type ProposalCard,
  type ReplyOutcome,
} from "./prompt.ts";
export { generateProposals, probeOllama, type GenerateInput, type GenerateResult } from "./generate.ts";
export { buildMaskPrompt, parseMaskReply } from "./mask.ts";
