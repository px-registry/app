// R1.5 meet network lane — barrel. app/meet imports ONLY from here; the gates
// pin fetch to api.ts and localStorage to local.ts.

export { deriveParticipantRef, isParticipantRef, isOwnerToken } from "./ref.ts";
export {
  getOrMintOwnerToken,
  clearOwnerToken,
  getPublishedSnapshot,
  setPublishedSnapshot,
  boundarySeen,
  markBoundarySeen,
} from "./local.ts";
export { buildOutboundProjection, type OutboundPoolItem } from "./projection.ts";
export {
  publishProjection,
  fetchPool,
  sendSignal,
  fetchInbox,
  saveContactNote,
  submitLog,
  fetchHostView,
  type PoolItemPublic,
  type NetResult,
  type InboxData,
  type InboxIncoming,
} from "./api.ts";
