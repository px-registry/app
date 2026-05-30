// Attested Board — external action URL policy.
//
// externalActionUrl is owner-controlled and rendered on a public route, so it is
// a sanitize surface (N6 payment boundary + XSS/phishing). The policy is strict
// and fail-closed: only http/https absolute URLs with no control characters
// survive. Anything else (javascript:/data:/file:/blob:, a relative string, a
// control char, a parse failure) is dropped — the record simply has no action
// link rather than a dangerous one.

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/** True if the string contains any ASCII control char (U+0000–U+001F or U+007F). */
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return true;
  }
  return false;
}

/**
 * Return the URL only if it is a safe owner action link; otherwise undefined.
 * Pure and total — never throws.
 */
export function sanitizeExternalActionUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  // Check the ORIGINAL string: a trailing/embedded tab or newline must be
  // rejected, not silently trimmed (the WHATWG URL parser would strip them).
  if (hasControlChar(raw)) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return undefined; // not an absolute URL
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return undefined;
  return url.href;
}
