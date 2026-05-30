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
  TRANSACTION_EVENT_LABELS,
  DECLARATION_KIND_LABELS,
  TRANSACTION_COPY,
  allTransactionLabelStrings,
  type Label,
} from "./copy.ts";

export { SEED_BOARD_RECORDS } from "./seed.ts";

// ── A2: transaction loop ──────────────────────────────────────────────────────

export { newOpaqueId, isOpaqueId, type OpaqueIdPrefix } from "./ids.ts";

export { isPublicSafeOwnerRef, assertPublicSafeOwnerRef } from "./owner-ref.ts";

export {
  TRANSACTION_EVENT_KINDS,
  isTransactionEventKind,
  TRANSACTION_BOUNDARY,
  buildTransactionObject,
  planContactOpened,
  planHandoffDraft,
  type TransactionEventKindV1,
  type TransactionBoundary,
  type TransactionEventV1,
  type TransactionObjectV1,
} from "./transaction.ts";

export {
  DECLARATION_KINDS,
  isDeclarationKind,
  toPublicDeclaration,
  attachDeclarationRef,
  planDeclaration,
  type DeclarationKindV1,
  type StoredDeclarationRow,
  type PublicDeclarationRow,
  type DeclarationRecordV1,
} from "./declaration.ts";
