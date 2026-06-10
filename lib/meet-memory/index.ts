// R1.5 meet memory — barrel. app/meet imports ONLY from here (the meet gates
// ban direct storage symbols in the UI lane; this module is the audited home).

export {
  MEET_ENTRY_KINDS,
  type MeetProvenance,
  type MeetEntryKind,
  type MeetMemoryEntryV1,
  type MeetRigItemV1,
  type NewMeetEntry,
  type QuestionValue,
  type ProfileValue,
} from "./types.ts";

export {
  type MeetBackend,
  type KeyedBackend,
  InMemoryMeetBackend,
  InMemoryKeyedBackend,
} from "./backend.ts";
export { ReceivedStore, type ReceivedProposalV1, type ReadingV1 } from "./received.ts";
export { validateNewEntry, validateStoredEntry, type ValidationResult } from "./validate.ts";
export {
  MeetMemoryStore,
  MEET_EXPORT_FORMAT,
  type MeetMemoryExportV1,
  type ImportReport,
} from "./store.ts";
export { parseColdStartPaste, type MeetIntakeResult } from "./intake.ts";
export { COLDSTART_PROMPT, COLDSTART_NOTE } from "./coldstart.ts";
export { MEET_MEMORY_BOUNDARY, type MeetMemoryBoundary } from "./boundary.ts";
export {
  PLACED_QUESTION_TAG,
  draftPlacedQuestionTitle,
  draftPlacedQuestion,
  isPlacedQuestion,
} from "./placed.ts";
export { toPublicView, hasPublicVariant } from "./public-view.ts";
export { normalizeMaskText, parseMaskWords, findMaskLeaks } from "./mask-check.ts";

import { IndexedDbMeetBackend, MEMORY_STORE, RECEIVED_STORE } from "./indexeddb.ts";
import { MeetMemoryStore } from "./store.ts";
import { ReceivedStore, type ReceivedProposalV1 } from "./received.ts";
import type { MeetMemoryEntryV1 } from "./types.ts";

/** Browser-side memory store over IndexedDB. Call only from client components. */
export function openMeetMemory(): MeetMemoryStore {
  return new MeetMemoryStore(new IndexedDbMeetBackend<MeetMemoryEntryV1>(MEMORY_STORE));
}

/** Browser-side received-proposals shelf. Call only from client components. */
export function openReceived(): ReceivedStore {
  return new ReceivedStore(new IndexedDbMeetBackend<ReceivedProposalV1>(RECEIVED_STORE));
}
