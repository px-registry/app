// PX Work — R1 rig core proofs. Run with `node --test`.
//
// Proves the invariants STOP #0 turned on, plus the PR #34 hardening:
//   1. Non-ranking — no score/rank field on the rig types; pool preserves input
//      order (no sort by any quality measure).
//   2. Eligibility boundary — the SELF channel carries the owner's full memory
//      (private included) for self-grounding; the SHARED pool is PUBLIC only and
//      fail-closed, so a private item of any owner never reaches another owner's
//      prompt.
//   3. ownerRef projection — the shared pool / prompt identify a participant ONLY
//      by a session-local pseudonym (`ownerRef`); the raw `ownerId` (used only for
//      self-exclusion) never reaches the pool or any assembled prompt.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RIG_MEMORY_KINDS,
  RIG_LAW,
  buildPublicPool,
  buildOwnerPrompt,
  type RigOwnerV1,
} from "./rig.ts";

// Two owners. Each has a public + a private item; the private text is a sentinel
// we assert never crosses into the OTHER owner's prompt or the shared pool.
const AYA: RigOwnerV1 = {
  ownerId: "aya",
  items: [
    { kind: "have", title: "活版印刷の工房", text: "古い手キンで小ロット印刷", tags: ["手仕事", "ものづくり"], private: false },
    { kind: "memory", title: "AYA_PRIVATE_TITLE", text: "AYA_PRIVATE_SCAR", tags: ["内緒"], private: true },
    { kind: "want", title: "子どもと作る場", text: "親子で手を動かす時間", tags: ["親子"], private: false },
  ],
};
const BEN: RigOwnerV1 = {
  ownerId: "ben",
  items: [
    { kind: "have", title: "小さなカフェ", text: "昼だけ開ける間借り店", tags: ["飲食"], private: false },
    { kind: "avoid", title: "BEN_PRIVATE_TITLE", text: "BEN_PRIVATE_AVOID", tags: ["秘密"], private: true },
  ],
};
const OWNERS = [AYA, BEN];

// Session-local public-safe pseudonyms (NO substring overlap with any ownerId).
const REF = new Map<string, string>([
  ["aya", "参加者A"],
  ["ben", "参加者B"],
]);

// The intended call shape: the pool for a given owner excludes them and projects
// every other participant to their ownerRef.
const poolFor = (
  self: RigOwnerV1,
  owners: RigOwnerV1[] = OWNERS,
  refs: ReadonlyMap<string, string> = REF,
) => buildPublicPool(owners, { excludeOwnerId: self.ownerId, ownerRefById: refs });

test("memory kinds are the four cold-start kinds, in order", () => {
  assert.deepEqual([...RIG_MEMORY_KINDS], ["have", "want", "avoid", "memory"]);
});

test("buildPublicPool is fail-closed: only private===false items enter", () => {
  const pool = buildPublicPool(OWNERS, { ownerRefById: REF });
  // 3 public items total (2 from AYA, 1 from BEN); both private items excluded.
  assert.equal(pool.length, 3);
  const texts = pool.map((p) => p.text);
  assert.ok(!texts.includes("AYA_PRIVATE_SCAR"), "AYA private must be excluded");
  assert.ok(!texts.includes("BEN_PRIVATE_AVOID"), "BEN private must be excluded");
});

test("buildPublicPool preserves input order (no sort by any measure)", () => {
  const pool = buildPublicPool(OWNERS, { ownerRefById: REF });
  assert.deepEqual(
    pool.map((p) => `${p.ownerRef}:${p.kind}`),
    ["参加者A:have", "参加者A:want", "参加者B:have"],
  );
});

test("buildPublicPool treats private:undefined as excluded (fail-closed)", () => {
  const sketchy: RigOwnerV1 = {
    ownerId: "x",
    // @ts-expect-error — runtime guard must reject a non-strict-false private.
    items: [{ kind: "have", title: "leak", text: "LEAK", tags: [], private: undefined }],
  };
  const refs = new Map([["x", "参加者X"]]);
  assert.equal(buildPublicPool([sketchy], { ownerRefById: refs }).length, 0);
});

test("buildPublicPool treats a MISSING private field as excluded (fail-closed)", () => {
  const noFlag = {
    ownerId: "x",
    items: [{ kind: "have", title: "no-flag", text: "LEAK", tags: [] }],
  } as unknown as RigOwnerV1;
  const refs = new Map([["x", "参加者X"]]);
  assert.equal(buildPublicPool([noFlag], { ownerRefById: refs }).length, 0);
});

test("buildPublicPool: private:true excluded, ONLY private:false included", () => {
  const mix: RigOwnerV1 = {
    ownerId: "m",
    items: [
      { kind: "have", title: "公開", text: "PUBLIC_OK", tags: [], private: false },
      { kind: "memory", title: "秘", text: "PRIVATE_NO", tags: [], private: true },
    ],
  };
  const refs = new Map([["m", "参加者M"]]);
  const pool = buildPublicPool([mix], { ownerRefById: refs });
  assert.deepEqual(pool.map((p) => p.text), ["PUBLIC_OK"]);
});

test("ownerRef fail-closed: an owner with no (or blank) ref is dropped entirely", () => {
  // BEN has no ref; a blank ref is also unusable. Only AYA's public items survive,
  // and the raw ownerId is NEVER used as a fallback identifier.
  const partial = new Map<string, string>([["aya", "参加者A"], ["ben", "   "]]);
  const pool = buildPublicPool(OWNERS, { ownerRefById: partial });
  assert.deepEqual(pool.map((p) => p.ownerRef), ["参加者A", "参加者A"]);
  assert.ok(pool.every((p) => p.ownerRef === "参加者A"), "no BEN items, no raw ownerId");
});

test("future-field leak: an extra memory field never rides into pool or prompt", () => {
  // A future field (raw body / internal note) added to an item must NOT appear in
  // the public pool item nor in any prompt — the explicit pick drops it.
  const withExtra = {
    ownerId: "leaky",
    items: [
      {
        kind: "have",
        title: "見出し",
        text: "公開本文",
        tags: ["公開"],
        private: false,
        secret: "SECRET_LEAK",
        rawMemory: "RAW_LEAK",
        internalNote: "NOTE_LEAK",
      },
    ],
  } as unknown as RigOwnerV1;
  const refs = new Map([...REF, ["leaky", "参加者L"]]);
  const pool = buildPublicPool([withExtra], { ownerRefById: refs });
  assert.equal(pool.length, 1);
  assert.deepEqual(
    Object.keys(pool[0]).sort(),
    ["kind", "ownerRef", "tags", "text", "title"],
  );
  const prompt = buildOwnerPrompt(AYA, buildPublicPool([...OWNERS, withExtra], { ownerRefById: refs }));
  for (const leak of ["SECRET_LEAK", "RAW_LEAK", "NOTE_LEAK"]) {
    assert.ok(!prompt.includes(leak), `leaked future field into prompt: ${leak}`);
  }
});

test("the `private` field itself never appears in a pool item or the prompt", () => {
  const pool = buildPublicPool(OWNERS, { ownerRefById: REF });
  for (const item of pool) {
    assert.ok(!("private" in item), "pool item must not carry the private field");
  }
  // The law prose legitimately mentions the word "private"; what must NOT appear is
  // the FIELD rendered as data (e.g. "private: false").
  const prompt = buildOwnerPrompt(AYA, poolFor(AYA));
  assert.ok(
    !/private\s*[:：]\s*(true|false)/i.test(prompt),
    "prompt must not surface the private flag as a rendered field",
  );
});

test("pool item shape is the closed ownerRef set — no ownerId, no score/rank", () => {
  const item = buildPublicPool(OWNERS, { ownerRefById: REF })[0];
  for (const k of Object.keys(item)) {
    assert.ok(
      !/score|rank|rating|priority|weight/i.test(k),
      `pool item must not carry a ranking field: ${k}`,
    );
  }
  assert.ok(!("ownerId" in item), "raw ownerId must not be projected into the pool");
  assert.deepEqual(
    Object.keys(item).sort(),
    ["kind", "ownerRef", "tags", "text", "title"],
  );
});

test("intake carries wobbly tags THROUGH verbatim (fail-closed is pool-private only)", () => {
  // A tag that the public-tag guard would reject (long, sentence-like) must NOT be
  // dropped or validated at intake — the rig keeps it as the tester wrote it.
  const wobbly: RigOwnerV1 = {
    ownerId: "w",
    items: [
      {
        kind: "have",
        title: "走り書き",
        text: "雑なメモ",
        tags: ["手仕事", "これは とても 長い タグ っぽい 文章！"],
        private: false,
      },
    ],
  };
  const refs = new Map([["w", "参加者W"]]);
  const pool = buildPublicPool([wobbly], { ownerRefById: refs });
  assert.equal(pool.length, 1);
  assert.deepEqual(pool[0].tags, ["手仕事", "これは とても 長い タグ っぽい 文章！"]);
});

test("SELF/POOL lines render the one-line title with its text (concrete anchor)", () => {
  const prompt = buildOwnerPrompt(AYA, poolFor(AYA));
  assert.ok(prompt.includes("活版印刷の工房 — 古い手キンで小ロット印刷"), "self title—text");
  assert.ok(prompt.includes("小さなカフェ — 昼だけ開ける間借り店"), "pool title—text");
});

test("SELF block carries the owner's OWN private memory (self-grounding)", () => {
  const prompt = buildOwnerPrompt(AYA, poolFor(AYA));
  assert.ok(
    prompt.includes("AYA_PRIVATE_SCAR"),
    "owner's own private item must appear in their own prompt",
  );
});

test("eligibility boundary: another owner's private NEVER reaches this prompt", () => {
  const ayaPrompt = buildOwnerPrompt(AYA, poolFor(AYA));
  const benPrompt = buildOwnerPrompt(BEN, poolFor(BEN));
  // BEN's private avoid must not be in AYA's prompt; AYA's private must not be in BEN's.
  assert.ok(!ayaPrompt.includes("BEN_PRIVATE_AVOID"));
  assert.ok(!benPrompt.includes("AYA_PRIVATE_SCAR"));
});

test("prompt POOL block excludes the owner's own items (no self-proposal)", () => {
  const ayaPrompt = buildOwnerPrompt(AYA, poolFor(AYA));
  // AYA's own pseudonym must not appear in her own pool block; BEN's must.
  assert.ok(!ayaPrompt.includes("参加者A"), "pool block must not list owner's own ref");
  assert.ok(ayaPrompt.includes("参加者B"), "pool block lists other participants by ref");
});

test("FINAL leak backstop: no raw ownerId appears anywhere in any assembled prompt", () => {
  // The whole-string negative — the last defence after the per-item shape checks:
  // every assembled prompt, for every owner, must be free of every raw ownerId.
  const ids = OWNERS.map((o) => o.ownerId);
  for (const self of OWNERS) {
    const prompt = buildOwnerPrompt(self, poolFor(self));
    for (const id of ids) {
      assert.ok(
        !prompt.includes(id),
        `raw ownerId "${id}" leaked into ${self.ownerId}'s prompt`,
      );
    }
  }
});

test("prompt embeds the law verbatim and the output line", () => {
  const prompt = buildOwnerPrompt(AYA, poolFor(AYA));
  for (const rule of RIG_LAW.rules) assert.ok(prompt.includes(rule), `missing rule: ${rule}`);
  assert.ok(prompt.includes(RIG_LAW.output));
});

test("RIG_LAW non-ranking surface is complete (hardened wording)", () => {
  const prompt = buildOwnerPrompt(AYA, poolFor(AYA));
  // The explicit non-ranking instructions to the owner's model.
  assert.ok(prompt.includes("スコア・順位・評価をつけない・並べない"));
  assert.ok(prompt.includes("出す順番に順位の意味を持たせない"));
  // The cross-genre exploration direction stays, but the rank-readable "優先" is gone.
  assert.ok(prompt.includes("異ジャンルの相補をよく読む"));
  assert.ok(!prompt.includes("異ジャンルの相補を優先"), "old rank-readable wording removed");
  // private/avoid may inform judgment but must not be quoted into the body.
  assert.ok(prompt.includes("本文として引用・再掲しない"));
});

test("tags appear verbatim in the prompt (no sanitize/drop at render)", () => {
  const wobbly: RigOwnerV1 = {
    ownerId: "w",
    items: [
      { kind: "have", title: "走り書き", text: "メモ", tags: ["これは とても 長い タグ っぽい 文章！"], private: false },
    ],
  };
  const refs = new Map([...REF, ["w", "参加者W"]]);
  const prompt = buildOwnerPrompt(
    AYA,
    buildPublicPool([...OWNERS, wobbly], { excludeOwnerId: AYA.ownerId, ownerRefById: refs }),
  );
  assert.ok(prompt.includes("これは とても 長い タグ っぽい 文章！"));
});

test("buildOwnerPrompt is pure & deterministic (same input → identical output)", () => {
  const pool = poolFor(AYA);
  assert.equal(buildOwnerPrompt(AYA, pool), buildOwnerPrompt(AYA, pool));
});

test("empty pool (no other public items) degrades to the 'none today' line", () => {
  const solo = buildOwnerPrompt(AYA, poolFor(AYA, [AYA]));
  assert.ok(solo.includes("（今日の公開候補はありません）"));
  // The pool block HEADER legitimately says 「他の参加者…」; what must be absent is
  // any participant REF line (e.g. [参加者B]) when the pool is empty.
  assert.ok(!solo.includes("[参加者"), "no participant ref lines when the pool is empty");
});
