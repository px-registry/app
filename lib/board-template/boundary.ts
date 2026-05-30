// Board Templates v1 — boundary metadata (own module; A1/A2/B/B+1/Contact untouched).
//
// A standalone client constant (Board Templates is owner-local, so a client
// constant is the natural home — same pattern as the B and B+1 boundaries). It does
// NOT touch any A1/A2/B/B+1/Contact response object. It states the template
// posture: PX ranks no boards, judges no content, a template is a scaffold (not a
// prescription), and the minimum public criteria are structural (existence checks,
// not a judgment). Shown in the owner UI; it never mutates a server response.

export interface TemplateBoundary {
  pxDoesNotRankBoards: true;
  pxDoesNotJudgeContent: true;
  templateIsScaffold: true; // a starting point, not a prescription
  minCriteriaIsStructural: true; // existence/count, not a "good board" verdict
}

export const TEMPLATE_BOUNDARY: TemplateBoundary = Object.freeze({
  pxDoesNotRankBoards: true,
  pxDoesNotJudgeContent: true,
  templateIsScaffold: true,
  minCriteriaIsStructural: true,
});
