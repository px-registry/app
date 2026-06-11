// R1.5 visual refresh gates — the skin's promises, pinned. Run with `node --test`.
//
//   VR-1  token discipline — every colour literal in meet.css sits on a
//         custom-property definition line (components reference tokens only,
//         so paper/sumi invert the WHOLE surface through the token block)
//   VR-2  iOS ground — background-attachment is banned (fixed pseudo-element
//         carries the scene instead)
//   VR-3  the ring's sacred trio — outer 1.8 / inner 0.4 / gap 6 live as the
//         Ring component's constants (every size derives from them)
//   VR-4  減灯 — no glow filters; the only keyframes are the entrance rise
//         (the pulse is a still point, no 鼓動)
//   VR-5  two phases — the sumi override block exists on html[data-theme]
//   VR-6  --faint is rules & ornament only — never a text colour (the one
//         exception is the resting ring's stroke, an ornament by definition)
//   VR-7  the visual-refresh i18n keys exist in BOTH dictionaries and carry
//         no forbidden term (EN keys are draft, ungated — still scanned)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { findForbiddenTerm } from "./forbidden.ts";
import { en } from "../i18n/en.ts";
import { ja } from "../i18n/ja.ts";

const root = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const read = (rel: string) => readFileSync(root(rel), "utf8");

const css = () => read("app/meet/meet.css").replace(/\/\*[\s\S]*?\*\//g, "");

const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;

test("VR-1: colour literals appear only in custom-property definitions", () => {
  // declarations are ;-separated; a multi-line gradient stays one declaration
  const decls = css()
    .split(/[;{}]/)
    .map((d) => d.trim())
    .filter((d) => d !== "");
  const offenders = decls.filter((d) => COLOUR.test(d) && !d.startsWith("--"));
  assert.deepEqual(offenders, [], "components must reference tokens, never colour literals");
});

test("VR-2: background-attachment never returns (iOS)", () => {
  assert.ok(!css().includes("background-attachment"), "use the fixed pseudo-element scene");
});

test("VR-3: the Ring component holds the sacred trio 1.8 / 0.4 / 6", () => {
  const ring = read("app/meet/Ring.tsx");
  assert.ok(/const OUTER = 1\.8;/.test(ring), "outer 1.8");
  assert.ok(/const INNER = 0\.4;/.test(ring), "inner 0.4");
  assert.ok(/const GAP = 6;/.test(ring), "gap 6");
  // the close is a real transition in the stylesheet (reduced-motion stops it)
  assert.ok(css().includes("stroke-dashoffset"), "open→pair closes via stroke-dashoffset");
});

test("VR-4: 減灯 — no glow filter; the only keyframes are the entrance rise", () => {
  const c = css();
  assert.ok(!c.includes("drop-shadow"), "no glow filters");
  const keyframes = [...c.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]);
  assert.deepEqual(keyframes, ["m-rise"], "no pulse/breathe — the still point stays still");
});

test("VR-5: the sumi phase overrides the same token block", () => {
  const c = css();
  assert.ok(c.includes('html[data-theme="sumi"] .meet-scope'), "sumi override block exists");
  for (const must of ["--ground:", "--ink:", "--sub:", "--scene:", "--shu-lit:"]) {
    const sumi = c.slice(c.indexOf('html[data-theme="sumi"]'));
    assert.ok(sumi.includes(must), `sumi phase re-defines ${must}`);
  }
});

test("VR-6: --faint never colours text (rules & ornament only)", () => {
  // block-wise: any `color: var(--faint)` must belong to a ring selector
  const blocks = css().split("}");
  for (const b of blocks) {
    if (/[^-]color:\s*var\(--faint\)/.test(b)) {
      const selector = b.slice(0, b.indexOf("{"));
      assert.ok(/ring/.test(selector), `--faint as a text colour outside a ring: ${selector.trim()}`);
    }
  }
});

test("VR-7: visual-refresh i18n keys — both dictionaries, no forbidden term", () => {
  const enKeys = Object.keys(en).filter((k) => k.startsWith("meet."));
  const jaKeys = Object.keys(ja).filter((k) => k.startsWith("meet."));
  assert.ok(enKeys.length > 0, "the meet.* keys exist");
  assert.deepEqual(jaKeys.sort(), enKeys.sort(), "EN and JA carry the same meet.* key set");
  for (const k of [...enKeys, ...jaKeys]) {
    for (const dict of [en, ja]) {
      const v = dict[k];
      if (typeof v === "string" && v !== "") {
        assert.equal(findForbiddenTerm(v), null, `forbidden term in ${k}: ${v}`);
      }
    }
  }
});
