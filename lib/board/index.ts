// Attested Board — public API (Stage A1 spine).
//
// The board's board×proof spine: a closed canonical vocabulary, a public record
// that carries the machine-readable boundary, pure search, and routable paths.
// Self-contained (relative imports only) so the Pages Function bundle, the app,
// and the tests all import the same module.

export {
  SURFACE_SHAPES,
  INTENTS,
  isSurfaceShape,
  isIntent,
  MACHINE_READABLE_BOUNDARY,
  type SurfaceShape,
  type Intent,
  type MachineReadableBoundary,
} from "./canonical.ts";

export {
  type BoardRecordV1,
  type StoredBoardRow,
  type PublicBoardRow,
  type BoardMediaRef,
  PRIVATE_STORED_FIELDS,
} from "./types.ts";

export { toPublicRecord } from "./project.ts";
export { sanitizeExternalActionUrl } from "./url.ts";

export {
  parseSearchParams,
  filterBoard,
  type BoardSearchParams,
  type BoardSort,
} from "./query.ts";

export { boardDetailPath, BOARD_SEARCH_PATH } from "./href.ts";

export {
  SURFACE_SHAPE_LABELS,
  INTENT_LABELS,
  surfaceShapeLabel,
  intentLabel,
  allBoardLabelStrings,
  type Label,
} from "./copy.ts";

export { SEED_BOARD_RECORDS } from "./seed.ts";
