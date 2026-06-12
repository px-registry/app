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
  toRigPoolWithRefs,
  parseProposalReply,
  parseReplyOutcome,
  type ProposalCard,
  type ReplyOutcome,
  type BasisItem,
  type BasisMap,
} from "./prompt.ts";
export { anchorForRecipient, MAX_ANCHOR } from "./anchor.ts";
export { generateProposals, probeOllama, type GenerateInput, type GenerateResult } from "./generate.ts";
export { buildDetectPrompt, parseDetectReply, buildIntroPrompt, parseIntroReply } from "./mask.ts";
export {
  FIRST_NOTE_PROMPT,
  buildFirstNotePrompt,
  parseFirstNoteReply,
  firstNoteMaterialFor,
  type FirstNoteMaterial,
  type FirstNoteEntryLike,
} from "./firstnote.ts";
export {
  gateCardsByProvenance,
  entryFace,
  faceOfEntry,
  type EntryFace,
  type WholeFace,
  type GatedCard,
  type GatedCards,
} from "./provenance.ts";
export {
  pickPatrolTarget,
  PATROL_INTERVAL_MS,
  type PatrolQuestion,
  type PatrolDecision,
} from "./patrol.ts";
