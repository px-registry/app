// R1.5 meet memory — validator (Stage B lineage: lib/owner-memory/validate.ts).
//
// The single line every write crosses. Fail-closed: unknown kind, unknown
// provenance (AI-authored included), or an un-typed value is refused. A rig_item
// requires `private` to be an EXPLICIT boolean — there is no "default to public"
// path anywhere in the substrate.

import { RIG_MEMORY_KINDS } from "../rig/rig.ts";
import type { NewMeetEntry, MeetProvenance } from "./types.ts";
import { WITNESS_SOURCES } from "./journal-types.ts";

const PROVENANCES: readonly MeetProvenance[] = ["owner_written", "owner_imported_confirmed"];
const RIG_KIND_SET = new Set<string>(RIG_MEMORY_KINDS);
const WITNESS_SET = new Set<string>(WITNESS_SOURCES);

export type ValidationResult = { ok: true } | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * The rig_item body shape — extracted so the memory substrate (rig_item entry)
 * and the journal (content body) cross the SAME line. `private` must be an
 * EXPLICIT boolean (no default-to-public anywhere). Used by both validators.
 */
function validateRigBody(value: Record<string, unknown>): ValidationResult {
  if (typeof value.kind !== "string" || !RIG_KIND_SET.has(value.kind)) {
    return { ok: false, error: "rig_item: unknown item kind" };
  }
  if (typeof value.text !== "string" || value.text.trim() === "") {
    return { ok: false, error: "rig_item: text is required" };
  }
  if (typeof value.title !== "string") {
    return { ok: false, error: "rig_item: title must be a string" };
  }
  if (!Array.isArray(value.tags) || value.tags.some((t) => typeof t !== "string")) {
    return { ok: false, error: "rig_item: tags must be string[]" };
  }
  if (typeof value.private !== "boolean") {
    // Explicit boolean only — an absent/odd flag never becomes public.
    return { ok: false, error: "rig_item: private must be an explicit boolean" };
  }
  // 第2便 B: 候補に出すときの書き方 — optional plain strings only.
  if (value.publicTitle !== undefined && typeof value.publicTitle !== "string") {
    return { ok: false, error: "rig_item: publicTitle must be a string when present" };
  }
  if (value.publicText !== undefined && typeof value.publicText !== "string") {
    return { ok: false, error: "rig_item: publicText must be a string when present" };
  }
  // R2 0012: ビジネス旗 — optional plain boolean only.
  if (value.business !== undefined && typeof value.business !== "boolean") {
    return { ok: false, error: "rig_item: business must be a boolean when present" };
  }
  return { ok: true };
}

function isSourceRef(v: unknown): boolean {
  if (!isRecord(v)) return false;
  switch (v.channel) {
    case "note":
      return v.localRef === undefined || typeof v.localRef === "string";
    case "import":
      if (
        v.importKind !== undefined &&
        v.importKind !== "cold_start" &&
        v.importKind !== "csv" &&
        v.importKind !== "json"
      ) {
        return false;
      }
      return v.batchId === undefined || typeof v.batchId === "string";
    case "talk":
      return (
        (v.threadRef === undefined || typeof v.threadRef === "string") &&
        (v.messageRef === undefined || typeof v.messageRef === "string")
      );
    case "witness":
      return v.witnessRef === undefined || typeof v.witnessRef === "string";
    default:
      return false;
  }
}

export function validateNewEntry(input: unknown): ValidationResult {
  if (!isRecord(input)) return { ok: false, error: "entry must be an object" };
  if (!PROVENANCES.includes(input.provenance as MeetProvenance)) {
    // This is the line an AI-authored "fact" cannot cross.
    return { ok: false, error: `provenance must be one of ${PROVENANCES.join("/")}` };
  }
  const value = input.value;
  if (!isRecord(value)) return { ok: false, error: "value must be an object" };

  switch (input.kind) {
    case "rig_item":
      return validateRigBody(value);
    case "question": {
      if (typeof value.text !== "string") return { ok: false, error: "question: text must be a string" };
      return { ok: true };
    }
    case "profile": {
      if (typeof value.displayName !== "string") {
        return { ok: false, error: "profile: displayName must be a string" };
      }
      if (value.intro !== undefined && typeof value.intro !== "string") {
        return { ok: false, error: "profile: intro must be a string when present" };
      }
      return { ok: true };
    }
    case "mask_list": {
      if (!Array.isArray(value.words) || value.words.some((w) => typeof w !== "string")) {
        return { ok: false, error: "mask_list: words must be string[]" };
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: "unknown entry kind" };
  }
}

/** Narrowing helper used by import: full stored-entry shape (id + timestamps). */
export function validateStoredEntry(input: unknown): ValidationResult {
  if (!isRecord(input)) return { ok: false, error: "entry must be an object" };
  if (typeof input.entryId !== "string" || input.entryId.trim() === "") {
    return { ok: false, error: "entryId is required" };
  }
  if (typeof input.createdAt !== "string" || typeof input.updatedAt !== "string") {
    return { ok: false, error: "timestamps are required" };
  }
  return validateNewEntry(input as NewMeetEntry);
}

/**
 * 記憶装置 層1a — journal レコードの validator. Fail-closed. The SAME provenance
 * line (AI-authored refused) and the SAME rig body line as the substrate, plus
 * the discriminated-union integrity the type promises at runtime (so a hand-rolled
 * import bundle can't smuggle a malformed record past the type system):
 *   - content MUST carry a valid body; event MUST NOT carry a body
 *   - witnessSource only when sourceRef.channel === "witness"
 *   - supersedes / targetRef are non-empty strings when they appear
 * Validates the FULL stored record (recordId / seq / createdAt assigned).
 */
export function validateJournalRecord(input: unknown): ValidationResult {
  if (!isRecord(input)) return { ok: false, error: "journal record must be an object" };
  if (typeof input.recordId !== "string" || input.recordId.trim() === "") {
    return { ok: false, error: "recordId is required" };
  }
  if (typeof input.seq !== "number" || !Number.isInteger(input.seq) || input.seq < 0) {
    return { ok: false, error: "seq must be a non-negative integer" };
  }
  if (typeof input.createdAt !== "string" || input.createdAt === "") {
    return { ok: false, error: "createdAt is required" };
  }
  if (!PROVENANCES.includes(input.provenance as MeetProvenance)) {
    // The line an AI-authored record cannot cross — same as the substrate.
    return { ok: false, error: `provenance must be one of ${PROVENANCES.join("/")}` };
  }
  if (!isSourceRef(input.sourceRef)) {
    return { ok: false, error: "sourceRef must be a valid {channel,...} object" };
  }
  const channel = (input.sourceRef as { channel: string }).channel;

  switch (input.recordType) {
    case "content": {
      if (input.contentKind !== "rig_item" && input.contentKind !== "note") {
        return { ok: false, error: "content: contentKind must be rig_item|note" };
      }
      if (!isRecord(input.body)) return { ok: false, error: "content: body must be an object" };
      const b = validateRigBody(input.body);
      if (!b.ok) return b;
      if (input.witnessSource !== undefined) {
        if (channel !== "witness") {
          return { ok: false, error: "witnessSource only allowed when sourceRef.channel is witness" };
        }
        if (typeof input.witnessSource !== "string" || !WITNESS_SET.has(input.witnessSource)) {
          return { ok: false, error: `witnessSource must be one of ${WITNESS_SOURCES.join("/")}` };
        }
      }
      if (input.supersedes !== undefined && (typeof input.supersedes !== "string" || input.supersedes === "")) {
        return { ok: false, error: "supersedes must be a non-empty string when present" };
      }
      return { ok: true };
    }
    case "event": {
      if (input.eventKind !== "surface" && input.eventKind !== "forget") {
        return { ok: false, error: "event: eventKind must be surface|forget" };
      }
      if (typeof input.targetRef !== "string" || input.targetRef === "") {
        return { ok: false, error: "event: targetRef is required" };
      }
      if ("body" in input && input.body !== undefined) {
        return { ok: false, error: "event must not carry a body" };
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: "unknown recordType" };
  }
}
