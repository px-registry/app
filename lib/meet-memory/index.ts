// R1.5 meet memory — barrel. app/meet imports ONLY from here (the meet gates
// ban direct storage symbols in the UI lane; this module is the audited home).

export {
  MEET_ENTRY_KINDS,
  type MeetProvenance,
  type MeetEntryKind,
  type MeetMemoryEntryV1,
  type NewMeetEntry,
  type QuestionValue,
  type ProfileValue,
} from "./types.ts";

export { type MeetBackend, InMemoryMeetBackend } from "./backend.ts";
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

import { IndexedDbMeetBackend, MEMORY_STORE, RECEIVED_STORE } from "./indexeddb.ts";
import { MeetMemoryStore } from "./store.ts";
import type { MeetBackend } from "./backend.ts";

/** Browser-side store over IndexedDB. Call only from client components. */
export function openMeetMemory(): MeetMemoryStore {
  return new MeetMemoryStore(new IndexedDbMeetBackend(MEMORY_STORE));
}

/** Raw backend for the received-proposals shelf (Slice 3 wires its store). */
export function openReceivedBackend(): MeetBackend {
  return new IndexedDbMeetBackend(RECEIVED_STORE);
}
