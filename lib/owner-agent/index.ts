// Stage B+1 — owner-agent proposals. Public API.
//
// Owner-side composition of (owner-local memory) × (neutral board). Pure and
// deterministic: no store writes, no network, no model. The agent reads memory
// and proposes; the owner judges. PX stays memory-blind and ranks nothing.
//
// This barrel imports no OwnerMemoryStore write API and no network — the proposal
// road cannot mutate memory or send it anywhere (Cbp1-4/5).

export {
  type SearchParamsAllowlist,
  type ProposalReason,
  type ProposalV1,
  type MatchableListing,
} from "./types.ts";

export { memoryToSearchParams, allowlistToQueryString } from "./mapper.ts";

export { composeProposals, listingMatchesInterest, type ResultSet } from "./propose.ts";

export { PROPOSAL_BOUNDARY, type ProposalBoundary } from "./boundary.ts";

export {
  PROPOSAL_REASON_LABELS,
  PROPOSAL_COPY,
  reasonLabel,
  allProposalCopyStrings,
  type Label,
} from "./copy.ts";
