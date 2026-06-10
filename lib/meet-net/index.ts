// R1.5 meet network lane — barrel. app/meet imports ONLY from here; the gates
// pin fetch to api.ts and localStorage to local.ts.

export { deriveParticipantRef, isParticipantRef, isOwnerToken } from "./ref.ts";
export { getOrMintOwnerToken, clearOwnerToken } from "./local.ts";
export { buildOutboundProjection, type OutboundPoolItem } from "./projection.ts";
export {
  publishProjection,
  fetchPool,
  type PoolItemPublic,
  type NetResult,
} from "./api.ts";
