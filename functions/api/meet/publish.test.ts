// Integration tests for POST /api/meet/publish. Run with `node --test`.
//
// Drives the real handler against a fake D1 that records what would be written.
// The boundary proofs: the owner token is never written or echoed; a payload
// carrying a private/ownerId key is rejected whole; replacement is atomic
// (delete + inserts in ONE batch).

import { test } from "node:test";
import assert from "node:assert/strict";

import { onRequestPost } from "./publish.ts";
import { deriveParticipantRef } from "../../../lib/meet-net/ref.ts";

type Bound = { sql: string; args: unknown[] };

function fakeD1() {
  const batches: Bound[][] = [];
  return {
    batches,
    prepare(sql: string) {
      return {
        sql,
        args: [] as unknown[],
        bind(...args: unknown[]) {
          return { sql, args };
        },
      };
    },
    async batch(stmts: Bound[]) {
      batches.push(stmts);
      return stmts.map(() => ({ success: true }));
    },
  };
}

const TOKEN = "0123456789abcdef0123456789abcdef";
const GOOD = {
  ownerToken: TOKEN,
  displayName: "あや",
  items: [
    { kind: "have", title: "工房", text: "活版印刷ができる", tags: ["手仕事"], position: 0 },
    { kind: "want", title: "場", text: "親子の時間をつくりたい", tags: [], position: 1 },
  ],
};

function call(body: unknown, db = fakeD1()) {
  const request = new Request("https://app.px-registry.org/api/meet/publish", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://app.px-registry.org",
    },
    body: JSON.stringify(body),
  });
  return { res: onRequestPost({ request, env: { BOARD: db } } as never), db };
}

test("publish: a clean projection lands as one atomic batch", async () => {
  const { res, db } = call(GOOD);
  const r = await res;
  assert.equal(r.status, 201);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.count, 2);
  assert.equal(db.batches.length, 1, "one atomic batch");
  const [del, ...inserts] = db.batches[0];
  assert.match(del.sql, /DELETE FROM r15_pool_item/);
  assert.equal(inserts.length, 2);
});

test("publish: the owner token is never written to D1 nor echoed", async () => {
  const { res, db } = call(GOOD);
  const r = await res;
  const body = await r.json();
  const ref = await deriveParticipantRef(TOKEN);
  assert.equal(body.participantRef, ref, "the opaque ref is returned");
  assert.ok(!JSON.stringify(body).includes(TOKEN), "token never echoed");
  for (const stmt of db.batches.flat()) {
    assert.ok(!stmt.args.includes(TOKEN), "token never bound into SQL");
    assert.ok(stmt.args.every((a) => a !== TOKEN));
  }
});

test("publish: a private/ownerId key in any item rejects the WHOLE payload", async () => {
  for (const poison of [{ private: true }, { private: false }, { ownerId: "x" }, { ownerToken: "y" }]) {
    const body = {
      ...GOOD,
      items: [GOOD.items[0], { ...GOOD.items[1], ...poison }],
    };
    const { res, db } = call(body);
    const r = await res;
    assert.equal(r.status, 400, `poison key ${Object.keys(poison)[0]} must reject`);
    const j = await r.json();
    assert.equal(j.reason, "private_shape");
    assert.equal(db.batches.length, 0, "nothing written");
  }
});

test("publish: caps and shapes are fail-closed", async () => {
  const cases: Array<[unknown, string]> = [
    [{ ...GOOD, ownerToken: "short" }, "token"],
    [{ ...GOOD, displayName: "" }, "display_name"],
    [{ ...GOOD, displayName: "あ".repeat(31) }, "display_name"],
    [{ ...GOOD, items: [{ ...GOOD.items[0], kind: "score" }] }, "item_0_kind"],
    [{ ...GOOD, items: [{ ...GOOD.items[0], text: "" }] }, "item_0_text"],
    [
      { ...GOOD, items: Array.from({ length: 61 }, () => GOOD.items[0]) },
      "items",
    ],
  ];
  for (const [body, reason] of cases) {
    const { res, db } = call(body);
    const r = await res;
    assert.equal(r.status, 400);
    assert.equal((await r.json()).reason, reason);
    assert.equal(db.batches.length, 0);
  }
});

test("publish: a cross-origin write is refused before the body is read", async () => {
  const request = new Request("https://app.px-registry.org/api/meet/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify(GOOD),
  });
  const res = await onRequestPost({ request, env: { BOARD: fakeD1() } } as never);
  assert.equal(res.status, 403);
});

test("publish: an empty item list unpublishes (delete-only batch)", async () => {
  const { res, db } = call({ ...GOOD, items: [] });
  const r = await res;
  assert.equal(r.status, 201);
  assert.equal((await r.json()).count, 0);
  assert.equal(db.batches[0].length, 1, "just the delete");
});

// ── 第7便 B: ひとこと紹介 — optional, capped, written with the projection ───────

test("intro: absent publishes as '' (never required)", async () => {
  const { res, db } = call(GOOD);
  const r = await res;
  assert.equal(r.status, 201);
  const insert = db.batches[0][1];
  assert.ok(insert.sql.includes("intro"), "insert names the intro column");
  assert.equal(insert.args[2], "", "absent intro lands as empty string");
});

test("intro: a saved one-liner rides every row; odd values reject the payload whole", async () => {
  const { res, db } = call({ ...GOOD, intro: " 手を動かす場づくりが好き " });
  const r = await res;
  assert.equal(r.status, 201);
  for (const stmt of db.batches[0].slice(1)) {
    assert.equal(stmt.args[2], "手を動かす場づくりが好き", "trimmed intro on each row");
  }
  assert.equal((await call({ ...GOOD, intro: 7 }).res).status, 400, "non-string intro rejects");
  assert.equal((await call({ ...GOOD, intro: "あ".repeat(81) }).res).status, 400, "over-cap rejects");
});
