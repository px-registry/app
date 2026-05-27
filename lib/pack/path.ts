// Pack path normalization — PVP pack-spec §5.
//
// Nested entry names (folder/archive contents) are paths relative to their
// container. To keep pack_ids stable across operating systems and browsers —
// which disagree on separators and enumeration order — every such path is
// normalized to one form before it enters the manifest:
//
//   • separator is "/"            (Windows "\" is folded to "/")
//   • no leading slash            (paths are relative)
//   • no "." segment              (current-dir noise is dropped)
//   • no ".." segment             (no traversal — rejected, not resolved)
//   • no empty / duplicate "//"   (collapsed)

/** Best-effort normalize a raw path to the canonical relative form. */
export function normalizePath(raw: string): string {
  return raw
    .replace(/\\/g, "/")
    .split("/")
    .filter((seg) => seg !== "" && seg !== ".")
    .join("/");
}

/** True when `p` is already a valid normalized relative pack path. */
export function isNormalizedPath(p: string): boolean {
  if (p === "" || p.startsWith("/")) return false;
  return p.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}
