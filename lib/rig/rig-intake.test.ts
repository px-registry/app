// PX Work — R1 rig intake proofs (Atomic 2). Run with `node --test`.
//
// The intake is FAIL-CLOSED: malformed JSON never throws; only clean owners/items
// survive; a missing/odd `private` is never treated as public; ownerRef minting is
// deterministic; and the private-echo aid returns a bare boolean (never raw text).

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildOwnerPrompt, buildPublicPool, type RigOwnerV1 } from "./rig.ts";
import {
  parseRigOwners,
  assignOwnerRefs,
  effectiveOwnerRefs,
  pastedOutputEchoesPrivate,
  RIG_PRIVATE_ECHO_NOTE,
  RIG_SAMPLE_JSON,
} from "./rig-intake.ts";

test("malformed JSON does not throw — returns no owners + a warning", () => {
  const r = parseRigOwners("{ this is not json ");
  assert.deepEqual(r.owners, []);
  assert.ok(r.warnings.length >= 1);
});

test("non-array top level is rejected with a warning (no crash)", () => {
  const r = parseRigOwners(JSON.stringify({ ownerId: "x", items: [] }));
  assert.deepEqual(r.owners, []);
  assert.ok(r.warnings.length >= 1);
});

test("the bundled sample JSON parses cleanly into 2 owners", () => {
  const r = parseRigOwners(RIG_SAMPLE_JSON);
  assert.equal(r.owners.length, 2);
  assert.deepEqual(r.warnings, []);
});

test("a MISSING private field is never treated as public (fail-closed end-to-end)", () => {
  const r = parseRigOwners(
    JSON.stringify([
      { ownerId: "o1", items: [{ kind: "have", title: "t", text: "PUBLIC?", tags: [] }] },
    ]),
  );
  // Parser normalizes the missing flag to private:true …
  assert.equal(r.owners[0].items[0].private, true);
  // … so it cannot enter the public pool.
  const refs = assignOwnerRefs(r.owners);
  assert.equal(buildPublicPool(r.owners, { ownerRefById: refs }).length, 0);
});

test("private:undefined / non-boolean is normalized to private:true", () => {
  const r = parseRigOwners(
    JSON.stringify([
      { ownerId: "o1", items: [
        { kind: "have", title: "a", text: "x", tags: [], private: null },
        { kind: "have", title: "b", text: "y", tags: [], private: "false" },
        { kind: "have", title: "c", text: "z", tags: [], private: false },
      ] },
    ]),
  );
  assert.deepEqual(r.owners[0].items.map((i) => i.private), [true, true, false]);
});

test("an item missing an essential field (kind/text) is dropped with a warning", () => {
  const r = parseRigOwners(
    JSON.stringify([
      { ownerId: "o1", items: [
        { kind: "nope", title: "bad-kind", text: "x", tags: [], private: false },
        { kind: "have", title: "no-text", tags: [], private: false },
        { kind: "have", title: "ok", text: "good", tags: [], private: false },
      ] },
    ]),
  );
  assert.deepEqual(r.owners[0].items.map((i) => i.text), ["good"]);
  assert.ok(r.warnings.length >= 2);
});

test("broken tags degrade to [] verbatim; valid tags kept verbatim", () => {
  const r = parseRigOwners(
    JSON.stringify([
      { ownerId: "o1", items: [
        { kind: "have", title: "a", text: "x", tags: "not-an-array", private: false },
        { kind: "have", title: "b", text: "y", tags: ["手仕事", 3, "ものづくり"], private: false },
      ] },
    ]),
  );
  assert.deepEqual(r.owners[0].items[0].tags, []);
  assert.deepEqual(r.owners[0].items[1].tags, ["手仕事", "ものづくり"]);
});

test("owner without a usable ownerId, and duplicate ownerId, are dropped", () => {
  const r = parseRigOwners(
    JSON.stringify([
      { ownerId: "", items: [] },
      { ownerId: "dup", items: [{ kind: "have", title: "a", text: "x", tags: [], private: false }] },
      { ownerId: "dup", items: [{ kind: "have", title: "b", text: "y", tags: [], private: false }] },
    ]),
  );
  assert.deepEqual(r.owners.map((o) => o.ownerId), ["dup"]);
  assert.equal(r.owners[0].items[0].text, "x");
  assert.ok(r.warnings.length >= 2);
});

test("assignOwnerRefs is deterministic by intake order, with a >26 fallback", () => {
  const owners: RigOwnerV1[] = Array.from({ length: 28 }, (_, i) => ({
    ownerId: `o${i}`,
    items: [],
  }));
  const refs = assignOwnerRefs(owners);
  assert.equal(refs.get("o0"), "参加者A");
  assert.equal(refs.get("o1"), "参加者B");
  assert.equal(refs.get("o25"), "参加者Z");
  assert.equal(refs.get("o26"), "参加者27");
  assert.equal(refs.get("o27"), "参加者28");
});

test("effectiveOwnerRefs: a nickname overrides the default; blank falls back", () => {
  const owners: RigOwnerV1[] = [
    { ownerId: "o0", items: [] },
    { ownerId: "o1", items: [] },
    { ownerId: "o2", items: [] },
  ];
  const refs = effectiveOwnerRefs(owners, { o0: "あや", o1: "   " });
  assert.equal(refs.get("o0"), "あや", "nickname applied");
  assert.equal(refs.get("o1"), "参加者B", "blank nickname falls back to default");
  assert.equal(refs.get("o2"), "参加者C", "no override keeps default");
});

test("effectiveOwnerRefs: a nickname flows into the prompt; raw ownerId never does", () => {
  const { owners } = parseRigOwners(RIG_SAMPLE_JSON);
  const refs = effectiveOwnerRefs(owners, { [owners[1].ownerId]: "カフェの人" });
  const self = owners[0];
  const pool = buildPublicPool(owners, { excludeOwnerId: self.ownerId, ownerRefById: refs });
  const prompt = buildOwnerPrompt(self, pool);
  assert.ok(prompt.includes("カフェの人"), "nickname appears as the pool ownerRef");
  for (const o of owners) assert.ok(!prompt.includes(o.ownerId), "no raw ownerId");
});

const SELF: RigOwnerV1 = {
  ownerId: "self",
  items: [
    { kind: "have", title: "公開の見出し", text: "公開してよい本文", tags: [], private: false },
    { kind: "memory", title: "原点", text: "祖父の印刷所で育った", tags: [], private: true },
    { kind: "avoid", title: "苦手", text: "大人数の貸切は避けたい", tags: [], private: false },
  ],
};

test("private-echo aid: true when a private/avoid raw text is echoed in output", () => {
  assert.equal(
    pastedOutputEchoesPrivate(SELF, "提案：…祖父の印刷所で育った…という縁で。"),
    true,
  );
  // avoid text echoed (even though that item is private:false) also flags.
  assert.equal(
    pastedOutputEchoesPrivate(SELF, "…大人数の貸切は避けたい…"),
    true,
  );
});

test("private-echo aid: false when only public text appears, and on empty output", () => {
  assert.equal(pastedOutputEchoesPrivate(SELF, "公開してよい本文だけが出ている"), false);
  assert.equal(pastedOutputEchoesPrivate(SELF, "   "), false);
});

test("end-to-end: prompts from parsed intake show ownerRef, never raw ownerId", () => {
  // The exact data path the harness uses: parse -> mint refs -> core build. The
  // assembled prompt the facilitator copies must never contain a raw ownerId.
  const { owners } = parseRigOwners(RIG_SAMPLE_JSON);
  const refs = assignOwnerRefs(owners);
  const ids = owners.map((o) => o.ownerId);
  for (const self of owners) {
    const pool = buildPublicPool(owners, { excludeOwnerId: self.ownerId, ownerRefById: refs });
    const prompt = buildOwnerPrompt(self, pool);
    for (const id of ids) {
      assert.ok(!prompt.includes(id), `raw ownerId "${id}" leaked into a prompt`);
    }
    // the other participant is attributed by their pseudonym
    const otherRef = refs.get(owners.find((o) => o.ownerId !== self.ownerId)!.ownerId)!;
    assert.ok(prompt.includes(otherRef), "other participant shown by ownerRef");
  }
});

test("private-echo NOTE is a fixed string that never re-shows raw private text", () => {
  // The aid returns a boolean only; the displayed note is a constant with no
  // interpolation, so a private body can never be re-exposed through the warning.
  assert.equal(typeof RIG_PRIVATE_ECHO_NOTE, "string");
  assert.ok(!RIG_PRIVATE_ECHO_NOTE.includes("祖父の印刷所で育った"));
  assert.ok(!RIG_PRIVATE_ECHO_NOTE.includes("大人数の貸切は避けたい"));
});
