// Integration tests for the R2 edge / contact / inbox / log / host lanes.
// Run with `node --test`.
//
// R2 0010 (期待の追従): the signal lane is EDGE-scoped now — these pins moved
// from the pair-unit world (r15_signal, two-direction EXISTS) to the edge world
// (r15_edge, T1/T2 transition guards). The fake D1 records SQL + bindings (it
// does not interpret SQL), so behavioral rules that live in SQL are pinned
// STRUCTURALLY here and exercised for real in the smoke before deploy.

import { test } from "node:test";
import assert from "node:assert/strict";

import { onRequestPost as signalPost } from "./signal.ts";
import { onRequestPost as talkbackPost } from "./talkback.ts";
import { onRequestPost as closePost } from "./close.ts";
import { onRequestPost as inboxPost } from "./inbox.ts";
import { onRequestPost as logPost } from "./log.ts";
import { onRequestPost as hostPost } from "./host.ts";
import { deriveDormant, DORMANT_TTL_DAYS } from "../../_meet.ts";
import { deriveParticipantRef } from "../../../lib/meet-net/ref.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";
const PEER = "b".repeat(16);
const EDGE = "edge_" + "c".repeat(16);
const BASIS = "d".repeat(16);

type Call = { sql: string; args: unknown[] };

function fakeD1(rowsFor: (sql: string) => unknown[] = () => []) {
  const calls: Call[] = [];
  return {
    calls,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          calls.push({ sql, args });
          return {
            async all() {
              return { results: rowsFor(sql), success: true, meta: {} };
            },
            async run() {
              return { success: true, meta: {} };
            },
          };
        },
        // bind-less reads (e.g. the host's whole-table scans)
        async all() {
          calls.push({ sql, args: [] });
          return { results: rowsFor(sql), success: true, meta: {} };
        },
        async run() {
          calls.push({ sql, args: [] });
          return { success: true, meta: {} };
        },
      };
    },
  };
}

function post(handler: unknown, path: string, body: unknown, db = fakeD1(), env: Record<string, unknown> = {}) {
  const request = new Request(`https://app.px-registry.org/api/meet/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://app.px-registry.org" },
    body: JSON.stringify(body),
  });
  return {
    res: (handler as (c: unknown) => Promise<Response>)({ request, env: { BOARD: db, ...env } }),
    db,
  };
}

// rowsFor helpers — the three reads T1 makes, told apart by their SQL shape.
const POOL_PRESENCE = (sql: string) => sql.includes("r15_pool_item") && !sql.includes("item_ref");
const BASIS_CHECK = (sql: string) => sql.includes("r15_pool_item") && sql.includes("item_ref");
const LIVE_TRIPLE = (sql: string) => sql.includes("FROM r15_edge");

const t1Body = {
  ownerToken: TOKEN,
  toRef: PEER,
  fromName: "あや",
  anchor: "工房 × 夜の店",
  edgeId: EDGE,
  basisItemRef: BASIS,
};

// ── signal = T1 (∅→sent) ───────────────────────────────────────────────────────

test("T1: opens an edge as 'sent' — never mutual, token never bound", async () => {
  const db = fakeD1((sql) => (LIVE_TRIPLE(sql) ? [] : [{ x: 1 }]));
  const { res } = post(signalPost, "signal", t1Body, db);
  const r = await res;
  assert.equal(r.status, 201);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.state, "sent", "T1 writes sent — T2 is the only mutual writer");
  assert.equal(body.existing, false);
  assert.ok(!("mutual" in body), "no pair-mutual flag survives (両方向sent≠mutual)");
  const insert = db.calls.find((c) => c.sql.includes("INSERT INTO r15_edge"));
  assert.ok(insert, "edge insert issued");
  assert.match(insert!.sql, /'sent'/, "state literal is sent");
  const fromRef = await deriveParticipantRef(TOKEN);
  assert.ok(insert!.args.includes(fromRef), "derived ref bound");
  assert.ok(!insert!.args.includes(TOKEN), "token never bound");
  assert.ok(!db.calls.some((c) => c.sql.includes("r15_signal")), "pair table is never touched");
});

test("T1: a live edge on the same (a,b,basis) is returned honestly — no second room", async () => {
  const db = fakeD1((sql) =>
    LIVE_TRIPLE(sql) ? [{ edge_id: "edge_existing00000000", state: "sent" }] : [{ x: 1 }],
  );
  const { res } = post(signalPost, "signal", t1Body, db);
  const r = await res;
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.existing, true, "押すことは一度押したこと");
  assert.equal(body.edgeId, "edge_existing00000000", "the EXISTING edge id comes back");
  assert.ok(!db.calls.some((c) => c.sql.includes("INSERT INTO r15_edge")), "no duplicate row");
});

test("T1 (c18 lifted): peer gone vs basis withdrawn — distinct honest codes, no row", async () => {
  const peerGone = fakeD1(() => []);
  const r1 = await post(signalPost, "signal", t1Body, peerGone).res;
  assert.equal(r1.status, 404);
  assert.equal((await r1.json()).error, "peer_not_in_pool");

  const basisGone = fakeD1((sql) => (POOL_PRESENCE(sql) ? [{ x: 1 }] : []));
  const r2 = await post(signalPost, "signal", t1Body, basisGone).res;
  assert.equal(r2.status, 404);
  assert.equal((await r2.json()).error, "basis_not_in_pool");
  assert.ok(!basisGone.calls.some((c) => c.sql.includes("INSERT")), "no edge row stored");
});

test("T1: bad shapes are refused before any D1 touch — incl. the r15pair_ reserve", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const cases: Array<[unknown, string]> = [
    [{ ...t1Body, toRef: me }, "self_signal"],
    [{ ...t1Body, edgeId: undefined }, "edge_id"],
    [{ ...t1Body, edgeId: "r15pair_" + "c".repeat(16) }, "edge_id"], // backfill 名前空間の偽装拒否
    [{ ...t1Body, edgeId: "not-an-edge" }, "edge_id"],
    [{ ...t1Body, basisItemRef: "" }, "basis_item_ref"],
    [{ ...t1Body, basisItemRef: "PRIVATE-id-1" }, "basis_item_ref"],
    [{ ...t1Body, fromName: "" }, "from_name"],
  ];
  for (const [body, code] of cases) {
    const { res, db } = post(signalPost, "signal", body);
    const r = await res;
    assert.equal(r.status, 400, `refused: ${code}`);
    assert.equal((await r.json()).error, code);
    assert.equal(db.calls.length, 0, "nothing touched D1");
  }
});

// ── talkback = T2 (sent→mutual, b only) ────────────────────────────────────────

const edgeRow = (state: string, b: string) => ({ a_ref: "a".repeat(16), b_ref: b, state });

test("T2: the addressee answers the edge — sent→mutual, guarded UPDATE", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const db = fakeD1((sql) => (sql.includes("SELECT a_ref") ? [edgeRow("sent", me)] : []));
  const { res } = post(talkbackPost, "talkback", { ownerToken: TOKEN, edgeId: EDGE }, db);
  const r = await res;
  assert.equal(r.status, 201);
  assert.equal((await r.json()).state, "mutual");
  const upd = db.calls.find((c) => c.sql.includes("UPDATE r15_edge"));
  assert.ok(upd, "update issued");
  assert.match(upd!.sql, /state = 'mutual'/);
  assert.match(upd!.sql, /AND state = 'sent'/, "transition guard in SQL");
  assert.match(upd!.sql, /last_act_b_at/, "b's act moves b's clock");
  assert.ok(!upd!.sql.includes("last_act_a_at"), "a's clock untouched by b's act");
  assert.ok(!db.calls.some((c) => c.sql.includes("r15_pool_item")),
    "T2 requires NO pool presence — プール離脱と可達性の分離 (0010 §5-b)");
});

test("T2: only b may write mutual — a (or a stranger) gets 403, no UPDATE", async () => {
  const db = fakeD1((sql) => (sql.includes("SELECT a_ref") ? [edgeRow("sent", "f".repeat(16))] : []));
  const { res } = post(talkbackPost, "talkback", { ownerToken: TOKEN, edgeId: EDGE }, db);
  const r = await res;
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, "not_addressee");
  assert.ok(!db.calls.some((c) => c.sql.includes("UPDATE")), "no transition written");
});

test("T2: mutual is idempotent; closed refuses honestly (T6: no reopen)", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const already = fakeD1((sql) => (sql.includes("SELECT a_ref") ? [edgeRow("mutual", me)] : []));
  const r1 = await post(talkbackPost, "talkback", { ownerToken: TOKEN, edgeId: EDGE }, already).res;
  assert.equal(r1.status, 200);
  assert.equal((await r1.json()).already, true);
  assert.ok(!already.calls.some((c) => c.sql.includes("UPDATE")));

  const closed = fakeD1((sql) => (sql.includes("SELECT a_ref") ? [edgeRow("closed", me)] : []));
  const r2 = await post(talkbackPost, "talkback", { ownerToken: TOKEN, edgeId: EDGE }, closed).res;
  assert.equal(r2.status, 409);
  assert.equal((await r2.json()).error, "edge_closed");

  const missing = fakeD1(() => []);
  const r3 = await post(talkbackPost, "talkback", { ownerToken: TOKEN, edgeId: EDGE }, missing).res;
  assert.equal(r3.status, 404);
});

// ── close = T3/T4/T5 (live→closed, participants only) ──────────────────────────

test("T3/T4/T5: a participant closes a live edge — closed_from records the SOURCE state", async () => {
  const me = await deriveParticipantRef(TOKEN);
  for (const from of ["sent", "mutual"]) {
    const db = fakeD1((sql) => (sql.includes("SELECT a_ref") ? [edgeRow(from, me)] : []));
    const { res } = post(closePost, "close", { ownerToken: TOKEN, edgeId: EDGE }, db);
    const r = await res;
    assert.equal(r.status, 201);
    assert.equal((await r.json()).state, "closed");
    const upd = db.calls.find((c) => c.sql.includes("UPDATE r15_edge"));
    assert.ok(upd, "update issued");
    assert.match(upd!.sql, /state = 'closed'/);
    assert.match(upd!.sql, /closed_from = /, "transition source recorded (0011)");
    assert.ok(upd!.args.includes(from), `closed_from binds the source state (${from})`);
    assert.ok(upd!.args.includes(me), "closed_by binds the actor");
    assert.ok(!/reason/i.test(upd!.sql), "no reason column — invariant 4");
  }
});

test("close: b's act moves b's clock (and only b's)", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const db = fakeD1((sql) => (sql.includes("SELECT a_ref") ? [edgeRow("sent", me)] : []));
  await post(closePost, "close", { ownerToken: TOKEN, edgeId: EDGE }, db).res;
  const upd = db.calls.find((c) => c.sql.includes("UPDATE r15_edge"));
  assert.match(upd!.sql, /last_act_b_at/, "addressee's close is b's act");
  assert.ok(!upd!.sql.includes("last_act_a_at"), "a's clock untouched");
});

test("close: a stranger gets 403; closed is idempotent (T6 — closed_by never overwritten)", async () => {
  const stranger = fakeD1((sql) =>
    sql.includes("SELECT a_ref") ? [{ a_ref: "x".repeat(16), b_ref: "y".repeat(16), state: "sent" }] : [],
  );
  const r1 = await post(closePost, "close", { ownerToken: TOKEN, edgeId: EDGE }, stranger).res;
  assert.equal(r1.status, 403);
  assert.equal((await r1.json()).error, "not_participant");
  assert.ok(!stranger.calls.some((c) => c.sql.includes("UPDATE")));

  const me = await deriveParticipantRef(TOKEN);
  const already = fakeD1((sql) => (sql.includes("SELECT a_ref") ? [edgeRow("closed", me)] : []));
  const r2 = await post(closePost, "close", { ownerToken: TOKEN, edgeId: EDGE }, already).res;
  assert.equal(r2.status, 200);
  assert.equal((await r2.json()).already, true);
  assert.ok(!already.calls.some((c) => c.sql.includes("UPDATE")), "first actor's record stands");
});

// ── dormant derivation (読み時導出 — 状態ではない) ──────────────────────────────

test("dormant: derived at read; acts wake it; closed never sleeps", () => {
  const now = new Date("2026-06-12T00:00:00Z");
  const old = "2026-01-01T00:00:00Z"; // > 90 days before now
  const fresh = "2026-06-01T00:00:00Z";
  assert.equal(deriveDormant("sent", old, old, "", now), true, "old sent edge sleeps");
  assert.equal(deriveDormant("sent", old, old, fresh, now), false, "a recent act wakes it");
  assert.equal(deriveDormant("mutual", old, fresh, "", now), false, "either side's act counts");
  assert.equal(deriveDormant("closed", old, old, "", now), false, "閉じは閉じ — 眠りではない");
  assert.ok(DORMANT_TTL_DAYS === 90, "TTL 仮90日 (命名・調整は後続)");
});

// ── contact ─────────────────────────────────────────────────────────────────────
// R2 GOAL 小掃除（期待の追従）: 旧 /api/meet/contact 書込端点は退場 — 渡すは
// E2EE 封筒（envelope-lanes.test.ts が正本）。平文書込の復活は R8 hook が遮断。
// 退場の構造 pin は下の「inbox never touches r15_contact_note」。

// ── inbox ───────────────────────────────────────────────────────────────────────

test("inbox: serves edges (incoming/outgoing) and never the pair table", async () => {
  const db = fakeD1(() => []);
  const { res } = post(inboxPost, "inbox", { ownerToken: TOKEN }, db);
  assert.equal((await res).status, 200);
  assert.ok(db.calls.some((c) => c.sql.includes("FROM r15_edge e")), "incoming reads edges");
  assert.ok(!db.calls.some((c) => c.sql.includes("r15_signal")), "pair table retired from serve");
});

test("inbox: never touches r15_contact_note (平文レーンの退場・期待の追従)", async () => {
  const db = fakeD1(() => []);
  const { res } = post(inboxPost, "inbox", { ownerToken: TOKEN }, db);
  const body = (await (await res).json()) as Record<string, unknown>;
  assert.ok(!db.calls.some((c) => c.sql.includes("r15_contact_note")), "档案は読まれない");
  assert.ok(!("notes" in body) && !("myNotes" in body), "平文 keys は serve に存在しない");
});

test("inbox: myItems = the caller's OWN public rows only (reverse-import serve)", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const db = fakeD1((sql) =>
    sql.includes("item_ref, kind, title, text, tags, business")
      ? [{ item_ref: "ab12".repeat(4), kind: "want", title: "t", text: "x", tags: '["問い"]', business: 0 }]
      : [],
  );
  const { res } = post(inboxPost, "inbox", { ownerToken: TOKEN }, db);
  const body = (await (await res).json()) as { myItems: Array<Record<string, unknown>> };
  assert.equal(body.myItems.length, 1);
  assert.deepEqual(body.myItems[0].tags, ["問い"], "tags served parsed");
  const q = db.calls.find((c) => c.sql.includes("item_ref, kind, title, text, tags, business"));
  assert.ok(q, "myItems query issued");
  assert.ok(q!.sql.includes("participant_ref = ?1"), "scoped to the caller");
  assert.ok(q!.args.includes(me), "bound to the derived ref");
  assert.ok(!q!.args.includes(TOKEN), "token never bound");
});

test("inbox: time order only, never a quality measure", async () => {
  const db = fakeD1(() => []);
  await post(inboxPost, "inbox", { ownerToken: TOKEN }, db).res;
  for (const c of db.calls) {
    assert.ok(!/score|rank|rating/i.test(c.sql), "no quality column in inbox SQL");
  }
});

// ── log ─────────────────────────────────────────────────────────────────────────

test("log: upserts by (participant_ref, client_entry_id); caps enforced", async () => {
  const db = fakeD1();
  const { res } = post(logPost, "log", {
    ownerToken: TOKEN,
    clientEntryId: "recv_abc",
    displayName: "あや",
    question: "問い",
    proposalText: "提案テキスト",
    reading: '{"echo":false}',
  }, db);
  assert.equal((await res).status, 201);
  const ins = db.calls.find((c) => c.sql.includes("INSERT INTO r15_log"));
  assert.ok(ins);
  assert.match(ins!.sql, /ON CONFLICT \(participant_ref, client_entry_id\)/);
  assert.ok(!ins!.args.includes(TOKEN), "token never bound");

  const bad = post(logPost, "log", {
    ownerToken: TOKEN,
    clientEntryId: "recv_abc",
    displayName: "あや",
    proposalText: "   ",
  });
  assert.equal((await bad.res).status, 400, "empty proposal refused");
});

// ── host ────────────────────────────────────────────────────────────────────────

test("host: fail-closed — unconfigured key serves nothing; wrong key 403", async () => {
  const noKey = post(hostPost, "host", { hostKey: "anything" }, fakeD1(), {});
  assert.equal((await noKey.res).status, 403);
  assert.equal(noKey.db.calls.length, 0, "no read without a configured key");

  const wrong = post(hostPost, "host", { hostKey: "wrong" }, fakeD1(), { FACILITATOR_KEY: "right" });
  assert.equal((await wrong.res).status, 403);
});

test("host: with the key, serves logs + edge rows + pool; contact notes NEVER", async () => {
  const db = fakeD1(() => []);
  const { res } = post(hostPost, "host", { hostKey: "right" }, db, { FACILITATOR_KEY: "right" });
  const r = await res;
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(Array.isArray(body.logs) && Array.isArray(body.signals));
  assert.ok(db.calls.some((c) => c.sql.includes("FROM r15_edge")), "edge lane is read");
  // fix1: the facilitator reading the candidate pool is part of the in-app
  // disclosure (テストの記録のため) — served here, key-gated.
  assert.ok(Array.isArray(body.pool));
  assert.ok(db.calls.some((c) => c.sql.includes("r15_pool_item")), "pool is read");
  for (const c of db.calls) {
    assert.ok(!c.sql.includes("r15_contact_note"), "host never reads contact notes");
  }
});
