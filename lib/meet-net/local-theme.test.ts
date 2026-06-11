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

const { getThemePref, setThemePref, THEME_INIT_SCRIPT } = await import("./local.ts");

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
