// Board Templates v1 — owner-local scaffold. Public API.
//
// Empty-board prevention without breaking "判定しない": a template is a SCAFFOLD
// (an editable starting point, never a PX prescription or ranking), and the minimum
// public criteria are a STRUCTURAL gate (existence/count, never content quality).
// A draft board is OWNER-LOCAL (browser IndexedDB) — PX holds no draft and no
// board/draft state; publishing rides the A1 path (v1 adds no endpoint, no D1 table).
//
// This barrel is node-safe: it re-exports no DOM-only module. The IndexedDB
// backend (./indexeddb.ts) is imported directly by client components.

export {
  CONTACT_READINESS_KINDS,
  PUBLICATION_STATES,
  type BoardTemplateV1,
  type TemplateSuggestedRow,
  type PublicContactReadinessV1,
  type ContactReadinessKind,
  type PublicationState,
  type DraftBoardV1,
  type DraftBoardRow,
  type NewDraftBoard,
  type NewDraftBoardRow,
} from "./types.ts";

export { BOARD_TEMPLATES, findTemplate, blankDraft } from "./catalog.ts";

export { templateToNewDraft, placeholdersFor } from "./instantiate.ts";

export {
  evaluatePublicCriteria,
  meetsPublicCriteria,
  type CriterionKey,
  type CriteriaResult,
} from "./criteria.ts";

export {
  projectForPublish,
  readinessExternalUrl,
  type PublishableRowV1,
  type PublishableBoardV1,
} from "./publish.ts";

export { type DraftBackend, InMemoryDraftBackend } from "./backend.ts";

export { DraftBoardStore } from "./draft-store.ts";

export { TEMPLATE_BOUNDARY, type TemplateBoundary } from "./boundary.ts";

export {
  TEMPLATE_COPY,
  CRITERION_COPY,
  CONTACT_READINESS_LABELS,
  allBoardTemplateCopyStrings,
  type Label,
} from "./copy.ts";
