// R1.5 — device-local identity (browser only). The ONLY file in lib/meet-net
// that touches localStorage (gate-pinned). The owner token is a random secret
// minted on first use; it identifies this owner's writes to the meet Functions
// and never appears in any public surface (the server derives an opaque
// participantRef from it and stores only the ref).

const TOKEN_KEY = "pxmeet:owner-token";

export function getOrMintOwnerToken(): string {
  const existing = localStorage.getItem(TOKEN_KEY);
  if (existing && /^[0-9a-f]{32,64}$/.test(existing)) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  localStorage.setItem(TOKEN_KEY, hex);
  return hex;
}

/** Forget this device's identity (端末の作り直し). Owner-local only. */
export function clearOwnerToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── small owner-local UI state (still: the ONLY localStorage file) ─────────────

const SNAPSHOT_KEY = "pxmeet:published-snapshot";
const BOUNDARY_KEY = "pxmeet:boundary-seen";

/** The projection as last successfully published (JSON) — for the 未反映 diff. */
export function getPublishedSnapshot(): string {
  return localStorage.getItem(SNAPSHOT_KEY) ?? "";
}
export function setPublishedSnapshot(json: string): void {
  localStorage.setItem(SNAPSHOT_KEY, json);
}

/** The boundary note is shown open once, then collapsed on later visits. */
export function boundarySeen(): boolean {
  return localStorage.getItem(BOUNDARY_KEY) === "1";
}
export function markBoundarySeen(): void {
  localStorage.setItem(BOUNDARY_KEY, "1");
}

// ── visual refresh — theme phase (paper | sumi), device-local UI pref ─────────
//
// G-2 (指示書 §7): the existing device-side persistence method IS this audited
// file (pxmeet:* keys in localStorage; same shape as the i18n px:lang pref), so
// the theme pref follows it rather than minting a new mechanism. The init
// script mirrors lib/i18n's LANG_INIT_SCRIPT: resolve before paint, write
// <html data-theme> — no flash.
//
// c12-1 (Hiroto 裁定): the DEFAULT is paper — prefers-color-scheme tracking is
// gone; only a manually saved pref overrides (保存値 → paper).

const THEME_KEY = "pxmeet:theme";

export type ThemePhase = "paper" | "sumi";

export function getThemePref(): ThemePhase | "" {
  const v = localStorage.getItem(THEME_KEY);
  return v === "paper" || v === "sumi" ? v : "";
}
export function setThemePref(phase: ThemePhase): void {
  localStorage.setItem(THEME_KEY, phase);
}

// Inline, dependency-free; injected verbatim into the meet layout.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='paper'&&t!=='sumi'){t='paper';}document.documentElement.setAttribute('data-theme',t);}catch(_){}})();`;

// ── c18b — 片づけた合図 (device-local hide list; server rows stay untouched) ───
//
// 「片づける」 is the owner's broom for DEBRIS: a non-mutual signal whose
// sender has left the pool. Hiding is a device-local list of peer refs — no
// server delete (R2), no history rewrite (c15 裁定). The list only SUPPRESSES
// a card while the peer is absent; a peer back in the pool shows again (the
// broom must never hide a living counterpart).

const HIDDEN_SIGNALS_KEY = "pxmeet:hidden-signals";

export function getHiddenSignalRefs(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(HIDDEN_SIGNALS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addHiddenSignalRef(ref: string): string[] {
  const list = getHiddenSignalRefs();
  if (!list.includes(ref)) list.push(ref);
  localStorage.setItem(HIDDEN_SIGNALS_KEY, JSON.stringify(list));
  return list;
}

// ── 第9便 B — 見回りの last-run (device-local; the 6h throttle's memory) ──────

const PATROL_GLOBAL_KEY = "pxmeet:patrol-last";
const PATROL_MAP_KEY = "pxmeet:patrol-by-question";

export function getPatrolLastRun(): string {
  return localStorage.getItem(PATROL_GLOBAL_KEY) ?? "";
}
export function getPatrolByQuestion(): Record<string, string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(PATROL_MAP_KEY) ?? "{}");
    if (typeof v !== "object" || v === null || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) if (typeof val === "string") out[k] = val;
    return out;
  } catch {
    return {};
  }
}
export function markPatrolRun(questionEntryId: string, at: string): void {
  localStorage.setItem(PATROL_GLOBAL_KEY, at);
  const map = getPatrolByQuestion();
  map[questionEntryId] = at;
  localStorage.setItem(PATROL_MAP_KEY, JSON.stringify(map));
}
