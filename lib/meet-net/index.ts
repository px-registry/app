// R1.5 meet network lane — barrel. app/meet imports ONLY from here; the gates
// pin fetch to api.ts and localStorage to local.ts.

export { deriveParticipantRef, isParticipantRef, isOwnerToken, mintEdgeId, mintEnvelopeId } from "./ref.ts";
export {
  getOrMintOwnerToken,
  clearOwnerToken,
  getPublishedSnapshot,
  setPublishedSnapshot,
  boundarySeen,
  markBoundarySeen,
  getPatrolLastRun,
  getPatrolByQuestion,
  markPatrolRun,
  getDismissedEdges,
  addDismissedEdge,
  getThemePref,
  setThemePref,
  THEME_INIT_SCRIPT,
  type ThemePhase,
} from "./local.ts";
export { buildOutboundProjection, type OutboundPoolItem, type ProjectableEntry } from "./projection.ts";
export {
  projectionSnapshotJson,
  snapshotRowSet,
  snapshotHas,
  snapshotPendingCount,
} from "./snapshot.ts";
export {
  publishProjection,
  fetchEncKey,
  fetchPool,
  sendEnvelope,
  fetchEnvelopes,
  ackEnvelopes,
  type SealedFields,
  type EnvelopeKind,
  type FetchedEnvelope,
  type ExpiredEnvelope,
  sendSignal,
  sendTalkBack,
  sendClose,
  fetchInbox,
  saveContactNote,
  submitLog,
  fetchHostView,
  type PoolItemPublic,
  type NetResult,
  type InboxData,
  type InboxIncoming,
  type InboxOutgoing,
  type EdgeState,
} from "./api.ts";
