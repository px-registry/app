// R1.5 meet memory — validator (Stage B lineage: lib/owner-memory/validate.ts).
//
// The single line every write crosses. Fail-closed: unknown kind, unknown
// provenance (AI-authored included), or an un-typed value is refused. A rig_item
// requires `private` to be an EXPLICIT boolean — there is no "default to public"
// path anywhere in the substrate.

import { RIG_MEMORY_KINDS } from "../rig/rig.ts";
import type { NewMeetEntry, MeetProvenance } from "./types.ts";

const PROVENANCES: readonly MeetProvenance[] = ["owner_written", "owner_imported_confirmed"];
const RIG_KIND_SET = new Set<string>(RIG_MEMORY_KINDS);

export type ValidationResult = { ok: true } | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
    case "rig_item": {
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
      return { ok: true };
    }
    case "question": {
      if (typeof value.text !== "string") return { ok: false, error: "question: text must be a string" };
      return { ok: true };
    }
    case "profile": {
      if (typeof value.displayName !== "string") {
        return { ok: false, error: "profile: displayName must be a string" };
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
