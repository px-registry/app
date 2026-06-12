// R1.5 visual refresh — theme pref pins (device-local lane). Run with `node --test`.
//
//   LT-1  the pref round-trips through the audited store and rejects junk
//   LT-2  the init script resolves stored pref → paper (c12-1 裁定: the default
//         is paper; prefers-color-scheme tracking is gone) and writes
//         <html data-theme> (no-flash, same shape as LANG_INIT_SCRIPT)
//   LT-3  G-2 — no NEW persistence lane: the theme key follows the existing
//         pxmeet: prefix in the one gate-pinned localStorage file

import { test } from "node:test";
import assert from "node:assert/strict";

// minimal localStorage stub — these tests run under node, not a browser
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

const { getThemePref, setThemePref, THEME_INIT_SCRIPT, getDismissedEdges, addDismissedEdge } =
  await import("./local.ts");

test("LT-1: theme pref round-trips; junk reads as unset", () => {
  store.clear();
  assert.equal(getThemePref(), "", "unset device");
  setThemePref("sumi");
  assert.equal(getThemePref(), "sumi");
  setThemePref("paper");
  assert.equal(getThemePref(), "paper");
  store.set("pxmeet:theme", "neon"); // junk never becomes a phase
  assert.equal(getThemePref(), "");
});

test("LT-2: the init script resolves pref → paper (c12-1: default is paper)", () => {
  assert.ok(THEME_INIT_SCRIPT.includes("pxmeet:theme"), "reads the stored pref");
  assert.ok(
    !THEME_INIT_SCRIPT.includes("prefers-color-scheme"),
    "OS-phase tracking is gone — the default phase is always paper",
  );
  assert.ok(THEME_INIT_SCRIPT.includes("'paper'"), "unset/junk resolves to paper");
  assert.ok(THEME_INIT_SCRIPT.includes("data-theme"), "writes the html attribute");
  assert.ok(THEME_INIT_SCRIPT.includes("try{"), "failure stays silent (paper default via CSS)");
});

test("LT-3: the theme key lives in the existing pxmeet: prefix (no new lane)", () => {
  store.clear();
  setThemePref("sumi");
  assert.deepEqual([...store.keys()], ["pxmeet:theme"], "one key, existing prefix");
});

// ── LT-4 (c18b→便4): 片づけた閉じ札 — edge 単位の device-local lane ─────────────
// 期待の追従: hidden-signals（相手単位・過渡形）は退場。後継は dismissed-edges。

test("LT-4: dismissed edges round-trip, dedupe, and survive junk", () => {
  store.clear();
  assert.deepEqual(getDismissedEdges(), [], "unset device hides nothing");
  addDismissedEdge("edge_cccccccccccccccc");
  addDismissedEdge("edge_dddddddddddddddd");
  addDismissedEdge("edge_cccccccccccccccc"); // pressing twice is pressing once
  assert.deepEqual(getDismissedEdges(), ["edge_cccccccccccccccc", "edge_dddddddddddddddd"]);
  assert.deepEqual([...store.keys()], ["pxmeet:dismissed-edges"], "existing pxmeet: prefix");
  store.set("pxmeet:dismissed-edges", "{broken"); // junk reads as empty, never throws
  assert.deepEqual(getDismissedEdges(), []);
  store.set("pxmeet:dismissed-edges", JSON.stringify(["ok", 7, null])); // non-strings drop
  assert.deepEqual(getDismissedEdges(), ["ok"]);
});
