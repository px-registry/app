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
export { FirstNoteStore, firstNoteKey, type FirstNoteDraftV1 } from "./firstnote.ts";
export { ItemAliasStore, mintItemRef, type ItemAliasV1 } from "./alias.ts";
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
export {
  normalizeMaskText,
  parseMaskWords,
  findMaskLeaks,
  filterDetections,
  applyMasks,
  mergeMaskWords,
  DEFAULT_MASK,
  type MaskPair,
} from "./mask-check.ts";

import { IndexedDbMeetBackend, MEMORY_STORE, RECEIVED_STORE, FIRSTNOTE_STORE, ALIAS_STORE } from "./indexeddb.ts";
import { MeetMemoryStore } from "./store.ts";
import { ReceivedStore, type ReceivedProposalV1 } from "./received.ts";
import { FirstNoteStore, type FirstNoteDraftV1 } from "./firstnote.ts";
import { ItemAliasStore, type ItemAliasV1 } from "./alias.ts";
import type { MeetMemoryEntryV1 } from "./types.ts";

/** Browser-side memory store over IndexedDB. Call only from client components. */
export function openMeetMemory(): MeetMemoryStore {
  return new MeetMemoryStore(new IndexedDbMeetBackend<MeetMemoryEntryV1>(MEMORY_STORE));
}

/** Browser-side received-proposals shelf. Call only from client components. */
export function openReceived(): ReceivedStore {
  return new ReceivedStore(new IndexedDbMeetBackend<ReceivedProposalV1>(RECEIVED_STORE));
}

/** Browser-side 第一信下書き lane (c17). Call only from client components. */
export function openFirstNotes(): FirstNoteStore {
  return new FirstNoteStore(new IndexedDbMeetBackend<FirstNoteDraftV1>(FIRSTNOTE_STORE));
}

/** Browser-side item_ref alias map (R2 0010). Call only from client components. */
export function openItemAliases(): ItemAliasStore {
  return new ItemAliasStore(new IndexedDbMeetBackend<ItemAliasV1>(ALIAS_STORE));
}
