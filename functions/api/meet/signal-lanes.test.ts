// Integration tests for the R1.5 signal / contact / inbox / log / host lanes.
// Run with `node --test`.
//
// The fake D1 records SQL + bindings (it does not interpret SQL), so behavioral
// rules that live in SQL (the mutual-only joins) are pinned STRUCTURALLY here
// and exercised for real in the wrangler-local smoke before deploy.

import { test } from "node:test";
import assert from "node:assert/strict";

import { onRequestPost as signalPost } from "./signal.ts";
import { onRequestPost as contactPost } from "./contact.ts";
import { onRequestPost as inboxPost } from "./inbox.ts";
import { onRequestPost as logPost } from "./log.ts";
import { onRequestPost as hostPost } from "./host.ts";
import { deriveParticipantRef } from "../../../lib/meet-net/ref.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";
const PEER = "b".repeat(16);

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

// ── signal ──────────────────────────────────────────────────────────────────────

test("signal: upserts one-sided, reports mutuality, never stores the token", async () => {
  // pool row present (c18 gate passes) + reverse signal row present (mutual)
  const db = fakeD1((sql) => (sql.includes("SELECT 1") ? [{ x: 1 }] : []));
  const { res } = post(signalPost, "signal", {
    ownerToken: TOKEN,
    toRef: PEER,
    fromName: "あや",
    anchor: "工房 × 夜の店",
  }, db);
  const r = await res;
  assert.equal(r.status, 201);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.mutual, true, "mutual reported when the reverse row exists");
  const insert = db.calls.find((c) => c.sql.includes("INSERT INTO r15_signal"));
  assert.ok(insert, "signal upsert issued");
  assert.match(insert!.sql, /ON CONFLICT \(from_ref, to_ref\)/);
  const fromRef = await deriveParticipantRef(TOKEN);
  assert.ok(insert!.args.includes(fromRef), "derived ref bound");
  assert.ok(!insert!.args.includes(TOKEN), "token never bound");
});

test("signal (c18): a peer with no pool presence is refused — no row, machine-readable code", async () => {
  // the pool probe returns nothing; anything else would return rows
  const db = fakeD1((sql) => (sql.includes("r15_pool_item") ? [] : [{ x: 1 }]));
  const { res } = post(signalPost, "signal", {
    ownerToken: TOKEN,
    toRef: PEER,
    fromName: "あや",
    anchor: "x",
  }, db);
  const r = await res;
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error, "peer_not_in_pool", "code is machine-readable");
  assert.ok(!db.calls.some((c) => c.sql.includes("INSERT INTO r15_signal")), "no signal row stored");
  // and the gate actually consults the pool, before any write
  const probe = db.calls.findIndex((c) => c.sql.includes("r15_pool_item"));
  assert.ok(probe >= 0, "pool presence is checked");
});

test("signal: self-signal and bad shapes are refused", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const cases: Array<[unknown, number]> = [
    [{ ownerToken: TOKEN, toRef: me, fromName: "あや" }, 400],
    [{ ownerToken: "short", toRef: PEER, fromName: "あや" }, 400],
    [{ ownerToken: TOKEN, toRef: "not-a-ref", fromName: "あや" }, 400],
    [{ ownerToken: TOKEN, toRef: PEER, fromName: "" }, 400],
  ];
  for (const [body, status] of cases) {
    const { res, db } = post(signalPost, "signal", body);
    assert.equal((await res).status, status);
    assert.equal(db.calls.length, 0, "nothing touched D1");
  }
});

// ── contact ─────────────────────────────────────────────────────────────────────

test("contact: REFUSED before the signal is mutual (custody rule)", async () => {
  const db = fakeD1((sql) => (sql.includes("AS m") ? [{ m: 0 }] : []));
  const { res } = post(contactPost, "contact", { ownerToken: TOKEN, peerRef: PEER, note: "LINE: aya" }, db);
  const r = await res;
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, "not_mutual");
  assert.ok(!db.calls.some((c) => c.sql.includes("INSERT INTO r15_contact_note")), "note never stored");
});

test("contact: stored (upsert) once mutual; token never bound", async () => {
  const db = fakeD1((sql) => (sql.includes("AS m") ? [{ m: 1 }] : []));
  const { res } = post(contactPost, "contact", { ownerToken: TOKEN, peerRef: PEER, note: "LINE: aya" }, db);
  assert.equal((await res).status, 201);
  const ins = db.calls.find((c) => c.sql.includes("INSERT INTO r15_contact_note"));
  assert.ok(ins, "note upsert issued");
  assert.ok(!ins!.args.includes(TOKEN));
});

// ── inbox ───────────────────────────────────────────────────────────────────────

test("inbox: notes are served through the mutual-only join (structural pin)", async () => {
  const db = fakeD1(() => []);
  const { res } = post(inboxPost, "inbox", { ownerToken: TOKEN }, db);
  assert.equal((await res).status, 200);
  const noteQuery = db.calls.find((c) => c.sql.includes("FROM r15_contact_note n"));
  assert.ok(noteQuery, "note query issued");
  const exists = noteQuery!.sql.match(/EXISTS\(SELECT 1 FROM r15_signal/g) ?? [];
  assert.equal(exists.length, 2, "BOTH signal directions are required in SQL");
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

test("host: with the key, serves logs + signals + pool; contact notes NEVER", async () => {
  const db = fakeD1(() => []);
  const { res } = post(hostPost, "host", { hostKey: "right" }, db, { FACILITATOR_KEY: "right" });
  const r = await res;
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.ok(Array.isArray(body.logs) && Array.isArray(body.signals));
  // fix1: the facilitator reading the candidate pool is part of the in-app
  // disclosure (テストの記録のため) — served here, key-gated.
  assert.ok(Array.isArray(body.pool));
  assert.ok(db.calls.some((c) => c.sql.includes("r15_pool_item")), "pool is read");
  for (const c of db.calls) {
    assert.ok(!c.sql.includes("r15_contact_note"), "host never reads contact notes");
  }
});
