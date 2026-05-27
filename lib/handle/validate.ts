// Handle validation — format + reserved-name check. Mirrors the px-box
// validateHandle semantics. Uniqueness (is this handle already registered?) is a
// separate, stateful check done against KV in the auth Function — this is the
// pure, synchronous part.

import {
  HANDLE_MAX,
  HANDLE_MIN,
  HANDLE_PATTERN,
  RESERVED_HANDLES,
} from "./constants.ts";

export type HandleValidation =
  | { valid: true; reason: null; handle: string }
  | { valid: false; reason: "invalid" | "reserved" };

/**
 * Validate a handle's format and that it is not reserved. Returns the trimmed,
 * normalized handle on success. Does NOT lowercase-fold: a handle is required to
 * already be lowercase (HANDLE_PATTERN enforces it), so "Foo" is invalid rather
 * than silently coerced — the stored key and the DNS label must be unambiguous.
 */
export function validateHandle(handle: unknown): HandleValidation {
  if (typeof handle !== "string") return { valid: false, reason: "invalid" };
  const h = handle.trim();
  if (h.length < HANDLE_MIN || h.length > HANDLE_MAX) {
    return { valid: false, reason: "invalid" };
  }
  if (!HANDLE_PATTERN.test(h)) return { valid: false, reason: "invalid" };
  if (h.includes("--")) return { valid: false, reason: "invalid" };
  if (RESERVED_HANDLES.has(h)) return { valid: false, reason: "reserved" };
  return { valid: true, reason: null, handle: h };
}
