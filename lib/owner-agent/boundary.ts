// Stage B+1 — proposal boundary metadata (own module; §5 byte-untouched).
//
// A standalone client constant — it does NOT touch the A1/A2/B response objects.
// It states the proposal posture: proposals are owner-side, PX ranks nothing, the
// agent neither writes memory nor acts, and memory stays on the device. Shown in
// the proposal UI; never mutates a server response.

export interface ProposalBoundary {
  proposalsAreOwnerSide: true;
  pxRanksNothing: true;
  agentDoesNotWriteMemory: true;
  agentDoesNotActOrTransact: true;
  memoryStaysOnDevice: true;
}

export const PROPOSAL_BOUNDARY: ProposalBoundary = Object.freeze({
  proposalsAreOwnerSide: true,
  pxRanksNothing: true,
  agentDoesNotWriteMemory: true,
  agentDoesNotActOrTransact: true,
  memoryStaysOnDevice: true,
});
