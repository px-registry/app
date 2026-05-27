// RFC 8785 — JSON Canonicalization Scheme (JCS).
//
// Canonicalization makes "the same data" serialize to the same bytes, so that
// hashing the bytes yields a stable identity. Two manifests with keys in a
// different order, or whitespace differences, must produce one pack_id.
//
// We implement JCS directly rather than pull a dependency: the input is a
// small, well-typed JSON subset (objects, arrays, strings, integers, booleans,
// null), and a self-contained implementation keeps the static export
// dependency-free and the behavior unit-testable. The two subtle rules:
//
//   1. Object keys are sorted by their UTF-16 code units. JavaScript's default
//      string comparison (`<`) already compares by UTF-16 code unit, so the
//      default Array.prototype.sort ordering is the JCS ordering.
//   2. Strings use minimal JSON escaping (only what JSON requires): the two
//      mandatory escapes (" and \), the short escapes for \b \t \n \f \r, and
//      \u00XX for the remaining C0 control characters. Nothing else is escaped
//      (no \uXXXX for non-ASCII, no escaped forward slash).
//
// Number handling: ECMAScript's Number→String already emits the shortest
// round-tripping decimal, which is exactly what JCS requires. We reject
// non-finite numbers (JSON has no NaN/Infinity). Our manifests only carry
// integers (byte counts), which serialize exactly.

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

const ESCAPES: Record<number, string> = {
  0x08: "\\b",
  0x09: "\\t",
  0x0a: "\\n",
  0x0c: "\\f",
  0x0d: "\\r",
  0x22: '\\"',
  0x5c: "\\\\",
};

/** Serialize a string with JCS-minimal escaping, wrapped in double quotes. */
function serializeString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    const escape = ESCAPES[code];
    if (escape !== undefined) {
      out += escape;
    } else if (code < 0x20) {
      out += "\\u" + code.toString(16).padStart(4, "0");
    } else {
      out += ch;
    }
  }
  return out + '"';
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Cannot canonicalize non-finite number: ${value}`);
  }
  // ECMAScript shortest round-trip representation === JCS number form.
  // Normalize the signed zero JS prints as "0" already (String(-0) === "0").
  return String(value);
}

/**
 * Return the RFC 8785 canonical JSON string for `value`. Deterministic:
 * equal data ⇒ identical bytes, regardless of input key order.
 *
 * `undefined`-valued object properties are dropped (matching JSON.stringify),
 * so optional manifest fields left unset do not perturb the canonical form.
 */
export function canonicalize(value: JsonValue): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return serializeNumber(value);
    case "string":
      return serializeString(value);
    case "object": {
      if (Array.isArray(value)) {
        return "[" + value.map((item) => canonicalize(item)).join(",") + "]";
      }
      const entries: string[] = [];
      // Default sort compares by UTF-16 code units — the JCS key ordering.
      for (const key of Object.keys(value).sort()) {
        const v = (value as { [key: string]: JsonValue })[key];
        if (v === undefined) continue;
        entries.push(serializeString(key) + ":" + canonicalize(v));
      }
      return "{" + entries.join(",") + "}";
    }
    default:
      // bigint, function, symbol, undefined — not valid JSON.
      throw new TypeError(`Cannot canonicalize value of type ${typeof value}`);
  }
}
