// Stage B — the owner-local memory validator.
//
// The gate that keeps memory typed, owner-authored, and free of arbitrary body:
//   * provenance is required and must be owner_written | owner_imported_confirmed.
//     "ai_generated" (or anything else) is rejected — AI proposals are not facts.
//   * each kind's value is checked against its closed shape — a freeform body
//     cannot be smuggled in under the wrong kind.
// Pure and total; used by the store on every write (so AI/agent code cannot
// bypass it) and by import-confirm flows.

import { MEMORY_KINDS } from "./types.ts";
import type { NewOwnerMemory, Provenance } from "./types.ts";

const PROVENANCES: ReadonlySet<string> = new Set<Provenance>([
  "owner_written",
  "owner_imported_confirmed",
]);

const SURFACE_SHAPES = new Set(["offered", "auction_like", "matching", "stand"]);
const INTENTS = new Set(["wanted", "offered", "ask"]);
const DENSITIES = new Set(["compact", "comfortable"]);
const VIEWS = new Set(["list", "cards"]);

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const isStr = (v: unknown): v is string => typeof v === "string";
const optStr = (v: unknown): v is string | undefined => v === undefined || typeof v === "string";

function validateValue(kind: string, value: unknown): string | null {
  if (typeof value !== "object" || value === null) return "value must be an object";
  const v = value as Record<string, unknown>;
  switch (kind) {
    case "saved_filter":
      if (v.surfaceShape !== undefined && !SURFACE_SHAPES.has(v.surfaceShape as string))
        return "saved_filter.surfaceShape must be A1 canonical";
      if (v.intent !== undefined && !INTENTS.has(v.intent as string))
        return "saved_filter.intent must be A1 canonical";
      if (!optStr(v.category) || !optStr(v.region) || !optStr(v.query))
        return "saved_filter category/region/query must be strings";
      return null;
    case "preference":
      if (v.displayDensity !== undefined && !DENSITIES.has(v.displayDensity as string))
        return "preference.displayDensity invalid";
      if (v.defaultBoardView !== undefined && !VIEWS.has(v.defaultBoardView as string))
        return "preference.defaultBoardView invalid";
      return null;
    case "interest":
      if (!isStr(v.label) || !v.label.trim()) return "interest.label must be a non-empty string";
      return null;
    case "note":
      if (!isStr(v.text)) return "note.text must be a string";
      return null;
    default:
      return "unknown kind";
  }
}

/** Validate a candidate entry. Rejects bad provenance, unknown kind, bad value. */
export function validateNewMemory(candidate: unknown): ValidationResult {
  if (typeof candidate !== "object" || candidate === null) return { ok: false, error: "not an object" };
  const c = candidate as Record<string, unknown>;

  if (!isStr(c.provenance) || !PROVENANCES.has(c.provenance)) {
    // This is the line that refuses an AI-authored fact ("ai_generated" etc.).
    return { ok: false, error: "provenance must be owner_written or owner_imported_confirmed" };
  }
  if (!isStr(c.kind) || !(MEMORY_KINDS as readonly string[]).includes(c.kind)) {
    return { ok: false, error: "unknown memory kind" };
  }
  const valueError = validateValue(c.kind, c.value);
  if (valueError) return { ok: false, error: valueError };
  return { ok: true };
}

/** True if the candidate is a valid NewOwnerMemory. */
export function isValidNewMemory(candidate: unknown): candidate is NewOwnerMemory {
  return validateNewMemory(candidate).ok;
}
