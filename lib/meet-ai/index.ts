// R1.5 meet AI lane — barrel. app/meet imports ONLY from here; the gates pin
// fetch to generate.ts and localStorage to keys.ts.

export { MEET_MODELS, DEFAULT_MODEL_ID, findModel, type MeetModel, type ProviderId } from "./models.ts";
export {
  getModel,
  setModel,
  getKey,
  setKey,
  getEndpoint,
  setEndpoint,
  isConnected,
  DEFAULT_OLLAMA_ENDPOINT,
} from "./keys.ts";
export { buildMeetPrompt, toRigPool, parseProposalReply, type ProposalCard } from "./prompt.ts";
export { generateProposals, type GenerateInput, type GenerateResult } from "./generate.ts";
