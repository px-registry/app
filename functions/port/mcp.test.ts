// チャットポート route の試験（fakeD1 — signal-lanes.test.ts の様式）。
// Run with `node --test`.
//
// 重要 pin:
//   * token 無し/不正 = 401（fail-closed の門）
//   * token はどの SQL bind にも乗らない（derive 後 DROP）
//   * read_candidates の serve は 気配 を数える（ページの serve と同じ一枚）
//   * place_question は additive INSERT（DELETE を発行しない — replace は publish
//     だけの動き）
//   * send_signal は performT1 を通る（mutual を書かない）
//   * draft_talk_link は mutual のみ・linkBase が #draft= で終わる（平文は
//     リンクの fragment — サーバに来ない）

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { onRequestPost, onRequestGet } from "./mcp.ts";
import { deriveParticipantRef } from "../../lib/meet-net/ref.ts";
import { MAX_QUESTION, MAX_TITLE, MAX_NAME, MAX_ANCHOR } from "../_meet.ts";
import {
  PORT_CAP_QUESTION,
  PORT_CAP_TITLE,
  PORT_CAP_NAME,
  PORT_CAP_ANCHOR,
} from "../../lib/port/tools.ts";

const TOKEN = "0123456789abcdef0123456789abcdef";
const PEER = "b".repeat(16);
const BASIS = "d".repeat(16);
const EDGE = "edge_" + "c".repeat(16);

type Call = { sql: string; args: unknown[] };

function fakeD1(rowsFor: (sql: string, args: unknown[]) => unknown[] = () => []) {
  const calls: Call[] = [];
  const stmt = (sql: string, args: unknown[]) => ({
    async all() {
      calls.push({ sql, args });
      return { results: rowsFor(sql, args), success: true, meta: {} };
    },
    async run() {
      calls.push({ sql, args });
      return { success: true, meta: {} };
    },
  });
  return {
    calls,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return stmt(sql, args);
        },
        ...stmt(sql, []),
      };
    },
    async batch(stmts: unknown[]) {
      // statements were already recorded at bind time via all/run — execute them
      for (const s of stmts as Array<{ run: () => Promise<unknown> }>) await s.run();
      return [];
    },
  };
}

function postMcp(body: unknown, db = fakeD1(), token: string | null = TOKEN) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const request = new Request("https://px.example/port/mcp", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return (onRequestPost as unknown as (c: unknown) => Promise<Response>)({
    request,
    env: { BOARD: db },
  });
}

function rpc(method: string, params?: unknown, id: number | undefined = 1) {
  return { jsonrpc: "2.0", ...(id !== undefined ? { id } : {}), method, ...(params !== undefined ? { params } : {}) };
}

async function toolResult(res: Response): Promise<{ raw: Record<string, unknown>; isError: boolean }> {
  const body = (await res.json()) as { result?: { content: Array<{ text: string }>; isError?: boolean } };
  return {
    raw: JSON.parse(body.result!.content[0].text) as Record<string, unknown>,
    isError: body.result!.isError === true,
  };
}

// ── 門 ─────────────────────────────────────────────────────────────────────────

test("port: no token → 401 (fail-closed)", async () => {
  const res = await postMcp(rpc("ping"), fakeD1(), null);
  assert.equal(res.status, 401);
});

test("port: off-shape token → 401; query-param key is accepted", async () => {
  const res = await postMcp(rpc("ping"), fakeD1(), "not-a-token");
  assert.equal(res.status, 401);
  const viaQuery = await (onRequestPost as unknown as (c: unknown) => Promise<Response>)({
    request: new Request(`https://px.example/port/mcp?k=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpc("ping")),
    }),
    env: { BOARD: fakeD1() },
  });
  assert.equal(viaQuery.status, 200);
});

test("port: GET → 405 (no SSE stream; stateless)", async () => {
  const res = await (onRequestGet as unknown as (c: unknown) => Promise<Response>)({
    request: new Request("https://px.example/port/mcp"),
    env: { BOARD: fakeD1() },
  });
  assert.equal(res.status, 405);
});

// ── handshake ──────────────────────────────────────────────────────────────────

test("initialize: echoes a known protocol version, names the server, instructs pull", async () => {
  const res = await postMcp(rpc("initialize", { protocolVersion: "2025-03-26" }));
  const body = (await res.json()) as {
    result: { protocolVersion: string; serverInfo: { name: string }; instructions: string };
  };
  assert.equal(body.result.protocolVersion, "2025-03-26");
  assert.equal(body.result.serverInfo.name, "px-meet-port");
  assert.ok(body.result.instructions.includes("get_law_and_manifest"));
});

test("notifications only → 202 empty", async () => {
  // id を持たない素の notification（rpc() ヘルパは default 引数で id を足すので使わない）
  const res = await postMcp({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(res.status, 202);
});

test("tools/list serves the closed set", async () => {
  const res = await postMcp(rpc("tools/list"));
  const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
  assert.deepEqual(
    body.result.tools.map((t) => t.name),
    ["get_law_and_manifest", "read_candidates", "read_inbox", "place_question", "send_signal", "draft_talk_link"],
  );
});

// ── P0 reads ───────────────────────────────────────────────────────────────────

test("get_law_and_manifest: law block + manifest ride together", async () => {
  const res = await postMcp(rpc("tools/call", { name: "get_law_and_manifest", arguments: {} }));
  const { raw } = await toolResult(res);
  assert.ok((raw.law as string).startsWith("【出会いの法】"));
  assert.ok((raw.manifest as { patrol: string }).patrol.includes("今日は無い"));
});

test("read_candidates: mine/candidates split, 気配 counted, token never bound", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const rows = [
    { participant_ref: me, display_name: "わたし", intro: "", kind: "want", title: "w", text: "t", tags: "[]", position: 0, item_ref: "1".repeat(16), business: 0 },
    { participant_ref: PEER, display_name: "あや", intro: "庭", kind: "want", title: "問いの札", text: "話したい", tags: '["問い"]', position: 0, item_ref: BASIS, business: 1 },
  ];
  const db = fakeD1((sql) => (sql.includes("FROM r15_pool_item") ? rows : []));
  const res = await postMcp(rpc("tools/call", { name: "read_candidates", arguments: {} }), db);
  const { raw } = await toolResult(res);
  assert.equal(raw.myName, "わたし");
  assert.equal((raw.mine as unknown[]).length, 1);
  const cands = raw.candidates as Array<Record<string, unknown>>;
  assert.equal(cands.length, 1);
  assert.equal(cands[0].participantRef, PEER);
  assert.equal(cands[0].antenna, true);
  assert.equal(cands[0].business, true);
  assert.ok(
    db.calls.some((c) => c.sql.includes("r15_question_serve")),
    "アンテナの serve は気配に数えられる",
  );
  assert.ok(
    !db.calls.some((c) => c.args.includes(TOKEN)),
    "token never bound",
  );
});

test("read_inbox: edges + held envelope COUNTS only (no ciphertext serve)", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const db = fakeD1((sql) => {
    if (sql.includes("e.b_ref = ?1 ORDER BY")) {
      return [{
        edge_id: EDGE, a_ref: PEER, from_name: "あや", from_intro: "", basis_item_ref: BASIS,
        anchor: "a × b", state: "mutual", closed_by: "", closed_from: "",
        created_at: "2026-06-01T00:00:00.000Z", last_act_a_at: "2026-06-12T00:00:00.000Z", last_act_b_at: "",
      }];
    }
    if (sql.includes("FROM r15_envelope")) return [{ edge_id: EDGE, kind: "message", n: 2 }];
    return [];
  });
  const res = await postMcp(rpc("tools/call", { name: "read_inbox", arguments: {} }), db);
  const { raw } = await toolResult(res);
  const inc = raw.incoming as Array<Record<string, unknown>>;
  assert.equal(inc[0].state, "mutual");
  const held = raw.heldEnvelopes as Array<Record<string, unknown>>;
  assert.deepEqual(held[0], { edgeId: EDGE, kind: "message", count: 2 });
  assert.ok(
    !JSON.stringify(raw).includes("ciphertext"),
    "封書の中身はここから読めない",
  );
  void me;
});

// ── P1 writes ──────────────────────────────────────────────────────────────────

test("place_question: no published name & no displayName → honest refusal", async () => {
  const db = fakeD1((sql) =>
    sql.includes("COUNT(*)") ? [{ display_name: null, intro: null, n: 0, maxpos: -1 }] : [],
  );
  const res = await postMcp(
    rpc("tools/call", { name: "place_question", arguments: { text: "週末に庭を直したい" } }),
    db,
  );
  const { raw, isError } = await toolResult(res);
  assert.equal(isError, true);
  assert.equal(raw.error, "no_display_name");
  assert.ok(!db.calls.some((c) => c.sql.includes("INSERT INTO r15_pool_item")));
});

test("place_question: additive INSERT with 問い tag — never a DELETE", async () => {
  const db = fakeD1((sql) =>
    sql.includes("COUNT(*)") ? [{ display_name: "わたし", intro: "", n: 2, maxpos: 1 }] : [],
  );
  const res = await postMcp(
    rpc("tools/call", { name: "place_question", arguments: { text: "週末に庭を直したい。手を貸してくれる人いますか" } }),
    db,
  );
  const { raw, isError } = await toolResult(res);
  assert.equal(isError, false);
  assert.match(raw.itemRef as string, /^[0-9a-f]{16}$/);
  const ins = db.calls.find((c) => c.sql.includes("INSERT INTO r15_pool_item"));
  assert.ok(ins, "additive insert issued");
  assert.ok((ins!.args as string[]).includes('["問い"]'), "tag 問い rides");
  assert.equal(ins!.args[6], 2, "position = maxpos + 1");
  assert.ok(!db.calls.some((c) => c.sql.includes("DELETE")), "additive — projection is not replaced");
  assert.ok(!db.calls.some((c) => c.args.includes(TOKEN)), "token never bound");
});

test("send_signal: walks T1 (sent, never mutual), names resolved from the pool", async () => {
  const db = fakeD1((sql, args) => {
    if (sql.includes("SELECT display_name")) {
      return [{ display_name: args[0] === PEER ? "あや" : "わたし" }];
    }
    if (sql.includes("FROM r15_edge")) return []; // no live triple
    if (sql.includes("r15_pool_item")) return [{ x: 1 }]; // presence + basis
    return [];
  });
  const res = await postMcp(
    rpc("tools/call", { name: "send_signal", arguments: { toRef: PEER, basisItemRef: BASIS, anchor: "庭 × 工具" } }),
    db,
  );
  const { raw, isError } = await toolResult(res);
  assert.equal(isError, false);
  assert.equal(raw.state, "sent");
  const ins = db.calls.find((c) => c.sql.includes("INSERT INTO r15_edge"));
  assert.ok(ins);
  assert.match(ins!.sql, /'sent'/, "T2 だけが mutual を書く");
  assert.ok((ins!.args as string[]).includes("わたし"), "fromName from own pool row");
  assert.ok((ins!.args as string[]).includes("あや"), "toName from peer pool row");
});

test("draft_talk_link: mutual only; linkBase ends with #draft= (plaintext never posted)", async () => {
  const me = await deriveParticipantRef(TOKEN);
  const mkDb = (state: string) =>
    fakeD1((sql) =>
      sql.includes("FROM r15_edge") ? [{ a_ref: me, b_ref: PEER, state }] : [],
    );
  const okRes = await postMcp(
    rpc("tools/call", { name: "draft_talk_link", arguments: { edgeId: EDGE } }),
    mkDb("mutual"),
  );
  const ok = await toolResult(okRes);
  assert.equal(ok.isError, false);
  assert.ok((ok.raw.linkBase as string).endsWith(`/meet/?room=${EDGE}#draft=`));
  const sentRes = await postMcp(
    rpc("tools/call", { name: "draft_talk_link", arguments: { edgeId: EDGE } }),
    mkDb("sent"),
  );
  const sent = await toolResult(sentRes);
  assert.equal(sent.isError, true);
  assert.equal(sent.raw.error, "not_mutual");
});

test("tool schema caps equal the server caps (drift pin)", () => {
  assert.equal(PORT_CAP_QUESTION, MAX_QUESTION);
  assert.equal(PORT_CAP_TITLE, MAX_TITLE);
  assert.equal(PORT_CAP_NAME, MAX_NAME);
  assert.equal(PORT_CAP_ANCHOR, MAX_ANCHOR);
});

test("unknown tool / unknown method are honest errors", async () => {
  const res = await postMcp(rpc("tools/call", { name: "drop_tables", arguments: {} }));
  const body = (await res.json()) as { result: { isError?: boolean } };
  assert.equal(body.result.isError, true);
  const res2 = await postMcp(rpc("resources/list"));
  const body2 = (await res2.json()) as { error: { code: number } };
  assert.equal(body2.error.code, -32601);
});

// ── 単一臓器（記憶装置 層2）: MCP transport も窓も同じ handlers-core を通る ──────

test("PORT-core: mcp.ts delegates to handlers-core (no tool SQL in the transport)", () => {
  const mcp = readFileSync(new URL("./mcp.ts", import.meta.url), "utf8");
  assert.ok(/from\s+["']\.\/handlers-core\.ts["']/.test(mcp), "mcp.ts imports the core");
  assert.ok(/callPortTool\s*\(/.test(mcp), "mcp.ts calls callPortTool");
  // the tool bodies (SQL) moved out — the transport must not re-implement them
  assert.ok(!mcp.includes("r15_pool_item"), "no pool SQL in the transport");
  assert.ok(!mcp.includes("r15_edge"), "no edge SQL in the transport");

  const core = readFileSync(new URL("./handlers-core.ts", import.meta.url), "utf8");
  assert.ok(/export\s+async\s+function\s+callPortTool/.test(core), "core exports the single implementation");
  assert.ok(core.includes("r15_pool_item") && core.includes("r15_edge"), "the tool bodies live in the core");
});
