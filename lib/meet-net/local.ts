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

// ── 便4 — 片づけた閉じ札 (edge-keyed; CLOSED cards only) ───────────────────────
//
// c18b の hidden-signals（相手単位・不在のあいだだけ伏せる過渡形）は退場した:
// 生きた残骸は T4「閉じる」がサーバの事実として置き換え、箒は **閉じた札だけ**
// に出る（生きているものに箒を出さない原則は構造になった）。伏せるのは端末
// だけ — サーバの行は歴史のまま（c15 裁定）。edge 単位キー（0010 §6 の退場形）。

const DISMISSED_EDGES_KEY = "pxmeet:dismissed-edges";

export function getDismissedEdges(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(DISMISSED_EDGES_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function addDismissedEdge(edgeId: string): string[] {
  const list = getDismissedEdges();
  if (!list.includes(edgeId)) list.push(edgeId);
  localStorage.setItem(DISMISSED_EDGES_KEY, JSON.stringify(list));
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
