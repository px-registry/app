// R2 0013 — 封筒レーンの structural pins. Run with `node --test`.
// fake D1 は SQL を解釈しない — SQL に住む規則は構造 pin＋実機 smoke の二段。

import { test } from "node:test";
import assert from "node:assert/strict";

import { onRequestPost as sendPost } from "./envelope.ts";
import { onRequestPost as fetchPost } from "./envelope-fetch.ts";
import { onRequestPost as ackPost } from "./envelope-ack.ts";
import { deriveParticipantRef } from "../../../lib/meet-net/ref.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";
const EDGE = "edge_" + "c".repeat(16);
const ENV_ID = "env_" + "e".repeat(16);

type Call = { sql: string; args: unknown[] };
function fakeD1(rowsFor: (sql: string) => unknown[] = () => []) {
  const calls: Call[] = [];
  return {
    calls,
    // 記録は prepare 時（bind なしで batch に渡る文も拾う）。bind は args を上書き。
    prepare(sql: string) {
      const entry: Call = { sql, args: [] };
      calls.push(entry);
      const exec = {
        all: async () => ({ results: rowsFor(sql), success: true, meta: {} }),
        run: async () => ({ success: true, meta: {} }),
      };
      return {
        ...exec,
        bind: (...args: unknown[]) => {
          entry.args = args;
          return exec;
        },
      };
    },
    async batch(stmts: unknown[]) {
      return stmts.map(() => ({ success: true }));
    },
  };
}

function post(handler: unknown, path: string, body: unknown, db = fakeD1()) {
  const request = new Request(`https://app.px-registry.org/api/meet/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://app.px-registry.org" },
    body: JSON.stringify(body),
  });
  return { res: (handler as (c: unknown) => Promise<Response>)({ request, env: { BOARD: db } }), db };
}

const GOOD = {
  ownerToken: TOKEN,
  envelopeId: ENV_ID,
  edgeId: EDGE,
  kind: "message",
  ephPub: '{"kty":"EC"}',
  iv: "aWl2",
  ciphertext: "Y2lwaGVy",
};

test("ENV-1: plaintext-ish keys refuse the WHOLE envelope (invariant 1 tripwire)", async () => {
  for (const poison of [{ text: "x" }, { plaintext: "x" }, { note: "x" }, { body: "x" }]) {
    const { res, db } = post(sendPost, "envelope", { ...GOOD, ...poison });
    const r = await res;
    assert.equal(r.status, 400);
    assert.equal((await r.json()).error, "plaintext_shape");
    assert.equal(db.calls.length, 0, "nothing touched D1");
  }
});

test("ENV-2: mutual edge の participant のみ投函できる", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const sentEdge = fakeD1((sql) =>
    sql.includes("SELECT a_ref") ? [{ a_ref: me, b_ref: "b".repeat(16), state: "sent" }] : [],
  );
  const r1 = await post(sendPost, "envelope", GOOD, sentEdge).res;
  assert.equal(r1.status, 403);
  assert.equal((await r1.json()).error, "not_mutual", "前室は mutual で開く");

  const stranger = fakeD1((sql) =>
    sql.includes("SELECT a_ref") ? [{ a_ref: "x".repeat(16), b_ref: "y".repeat(16), state: "mutual" }] : [],
  );
  const r2 = await post(sendPost, "envelope", GOOD, stranger).res;
  assert.equal(r2.status, 403);
  assert.equal((await r2.json()).error, "not_participant");
});

test("ENV-3: 投函は行為 — 送り手側の last_act が動く; ノートは (edge,author) upsert", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const db = fakeD1((sql) =>
    sql.includes("SELECT a_ref")
      ? [{ a_ref: me, b_ref: "b".repeat(16), state: "mutual" }]
      : [{ n: 0 }],
  );
  const r = await post(sendPost, "envelope", { ...GOOD, kind: "note" }, db).res;
  assert.equal(r.status, 201);
  const ins = db.calls.find((c) => c.sql.includes("INSERT INTO r15_envelope"));
  assert.ok(ins, "envelope insert issued");
  assert.match(ins!.sql, /ON CONFLICT \(edge_id, from_ref\) WHERE kind = 'note'/, "ノートは一人一枚");
  const act = db.calls.find((c) => c.sql.includes("UPDATE r15_edge SET last_act_a_at"));
  assert.ok(act, "sender's clock moves (a side here)");
  assert.ok(!db.calls.some((c) => c.args.includes(TOKEN)), "token never bound");
});

test("ENV-4: held queue cap → 429 queue_full（物理律速・課金なし）", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const db = fakeD1((sql) =>
    sql.includes("SELECT a_ref")
      ? [{ a_ref: me, b_ref: "b".repeat(16), state: "mutual" }]
      : [{ n: 50 }],
  );
  const r = await post(sendPost, "envelope", GOOD, db).res;
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, "queue_full");
  // 追補 pin（design lead 確認 2026-06-12）: expired tombstone は深さに数えない —
  // 数えると不在の相手の edge が死蔵で詰まったままになる。
  const cap = db.calls.find((c) => c.sql.includes("COUNT(*)"));
  assert.match(cap!.sql, /state = 'held'/, "cap counts held only — tombstones never clog the queue");
});

test("ENV-5: fetch — 規則の機械的実行（TTL→expired・closed のノート畳み）＋自分の held は返らない", async () => {
  const db = fakeD1(() => []);
  const r = await post(fetchPost, "envelope-fetch", { ownerToken: TOKEN }, db).res;
  assert.equal(r.status, 200);
  const sweep1 = db.calls.find((c) => c.sql.includes("SET state = 'expired'"));
  assert.ok(sweep1, "TTL sweep issued at read");
  assert.match(sweep1!.sql, /kind != 'note'/, "ノートは期限切れない（立つ）");
  assert.ok(
    db.calls.some((c) => c.sql.includes("DELETE FROM r15_envelope WHERE kind = 'note'") && c.sql.includes("state = 'closed'")),
    "縁が閉じれば立て札も畳まれる",
  );
  const serve = db.calls.find((c) => c.sql.includes("FROM r15_envelope v JOIN r15_edge e"));
  assert.ok(serve, "serve query issued");
  assert.match(serve!.sql, /v\.state = 'expired' OR v\.from_ref != \?1/, "自分の held は自分に返らない");
  // 既読・配達済みの語彙はこのレーンに存在しない
  for (const c of db.calls) assert.ok(!/read_at|delivered|seen/i.test(c.sql), "no receipt vocabulary");
});

test("ENV-6: ack は受け手ガードつきの行削除のみ — ノートは ack で消えない", async () => {
  const db = fakeD1(() => []);
  const r = await post(ackPost, "envelope-ack", { ownerToken: TOKEN, envelopeIds: [ENV_ID] }, db).res;
  assert.equal(r.status, 200);
  const del = db.calls.find((c) => c.sql.includes("DELETE FROM r15_envelope"));
  assert.ok(del, "delete issued");
  assert.match(del!.sql, /kind != 'note'/, "standing note is never acked away");
  assert.match(del!.sql, /state = 'expired' OR from_ref != \?1/, "held は宛先だけが消せる");
  assert.match(del!.sql, /a_ref = \?1 OR b_ref = \?1/, "participant guard");
});
