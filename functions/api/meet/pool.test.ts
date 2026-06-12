// Integration tests for GET /api/meet/pool. Run with `node --test`.
//
// Proofs: self-exclusion happens in SQL (the caller's ref is bound into the
// WHERE), the served shape is the closed public set (no token — none exists),
// and rows keep arrival order (the ORDER BY is publish-time, never a quality).

import { test } from "node:test";
import assert from "node:assert/strict";

import { onRequestGet } from "./pool.ts";

const ROWS = [
  {
    participant_ref: "aaaaaaaaaaaaaaaa",
    display_name: "あや",
    kind: "have",
    title: "工房",
    text: "活版印刷ができる",
    tags: '["手仕事"]',
    position: 0,
  },
  {
    participant_ref: "bbbbbbbbbbbbbbbb",
    display_name: "カフェの人",
    kind: "want",
    title: "夜の使い手",
    text: "夜の時間に店を活かしたい",
    tags: "not-json",
    position: 0,
  },
];

function fakeD1(rows = ROWS) {
  const seen: { sql?: string; args?: unknown[] } = {};
  return {
    seen,
    prepare(sql: string) {
      seen.sql = sql;
      return {
        bind(...args: unknown[]) {
          seen.args = args;
          return this;
        },
        async all() {
          return { results: rows, success: true, meta: {} };
        },
      };
    },
  };
}

function call(query: string, db = fakeD1()) {
  const request = new Request(`https://app.px-registry.org/api/meet/pool${query}`);
  return { res: onRequestGet({ request, env: { BOARD: db } } as never), db };
}

test("pool: serves the closed public shape; broken tags degrade to []", async () => {
  const { res } = call("?me=cccccccccccccccc");
  const r = await res;
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 2);
  assert.deepEqual(Object.keys(body.items[0]).sort(), [
    "kind",
    "ownerRef",
    "participantRef",
    "tags",
    "text",
    "title",
  ]);
  assert.deepEqual(body.items[0].tags, ["手仕事"]);
  assert.deepEqual(body.items[1].tags, [], "non-JSON tags degrade to []");
});

test("pool: the caller's own ref is excluded in SQL", async () => {
  const { res, db } = call("?me=aaaaaaaaaaaaaaaa");
  await res;
  assert.match(db.seen.sql ?? "", /participant_ref <> \?1/);
  assert.deepEqual(db.seen.args, ["aaaaaaaaaaaaaaaa"]);
});

test("pool: a malformed me param degrades to no exclusion (still serves)", async () => {
  const { res, db } = call("?me=<script>");
  const r = await res;
  assert.equal(r.status, 200);
  assert.deepEqual(db.seen.args, [""]);
});

test("pool: order is publish-time arrival, never a quality measure", async () => {
  const { res, db } = call("?me=cccccccccccccccc");
  await res;
  assert.match(db.seen.sql ?? "", /ORDER BY updated_at, participant_ref, position/);
  assert.ok(!/score|rank|rating/i.test(db.seen.sql ?? ""));
});
