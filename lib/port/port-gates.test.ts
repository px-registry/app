// チャットポートの gate（構造 pin）。Run with `node --test`.
//
// 守るもの:
//   1. law 配布は RIG_LAW 正本の verbatim（写しでなく直 import — それでも形を pin）
//   2. Tool Contract: 定数 forbidden は PX 境界の4つだけ
//   3. 道具は閉じた集合 — 平文のトーク本文を受ける tool が存在しない（0013
//      invariant 1 の port 版・最重要 pin）
//   4. schema の caps は functions/_meet.ts の caps と同値（drift 検知）
//   5. プロトコル配管は fail-closed

import { test } from "node:test";
import assert from "node:assert/strict";

import { RIG_LAW } from "../rig/rig.ts";
import { buildLawText, buildPortManifest, PORT_FORBIDDEN } from "./manifest.ts";
import {
  PORT_TOOLS,
  PORT_TOOL_NAMES,
  PORT_CAP_QUESTION,
  PORT_CAP_TITLE,
  PORT_CAP_NAME,
  PORT_CAP_ANCHOR,
} from "./tools.ts";
import {
  parseRpc,
  negotiateProtocolVersion,
  MCP_PROTOCOL_VERSIONS,
  toolJson,
  rpcError,
} from "./protocol.ts";

// ── 1. law verbatim ─────────────────────────────────────────────────────────────

test("law text carries every RIG_LAW rule verbatim, numbered, with the output line", () => {
  const law = buildLawText();
  assert.ok(law.startsWith("【出会いの法】"));
  for (const [i, rule] of RIG_LAW.rules.entries()) {
    assert.ok(law.includes(`${i + 1}. ${rule}`), `rule ${i + 1} verbatim`);
  }
  assert.ok(law.includes(RIG_LAW.output));
});

// ── 2. Tool Contract ───────────────────────────────────────────────────────────

test("manifest forbidden = PX boundary constants only (§12 整理規則)", () => {
  assert.deepEqual(
    [...PORT_FORBIDDEN],
    ["pxRanking", "successFee", "storeCloudTranscriptOnPx", "privateDisclosure"],
  );
  const m = buildPortManifest();
  assert.deepEqual([...m.contract.forbidden], [...PORT_FORBIDDEN]);
  // owner↔agent の操作は二態 — 定数禁止をここに足さない（出自と確認の語で語る）
  assert.ok(m.contract.actions.outbound.includes("確認"));
  assert.ok(m.pull.includes("頼まれた時だけ"));
});

test("manifest speaks the honesty lines (PX runs no AI / stores no transcript / E2EE)", () => {
  const m = buildPortManifest();
  const all = m.honesty.join("\n");
  assert.ok(all.includes("PX は AI を実行しない"));
  assert.ok(all.includes("保管しない"));
  assert.ok(all.includes("E2EE"));
});

test("patrol guide demands grounding + honest 今日は無い + owner confirmation", () => {
  const p = buildPortManifest().patrol;
  assert.ok(p.includes("basisItemId"));
  assert.ok(p.includes("今日は無い"));
  assert.ok(p.includes("owner の確認"));
  assert.ok(p.includes("pull 原則"));
});

// ── 3. closed tool set / no-plaintext-talk pin ─────────────────────────────────

test("tools are a closed set (P0 reads + P1 writes + link)", () => {
  assert.deepEqual(
    [...PORT_TOOL_NAMES],
    [
      "get_law_and_manifest",
      "read_candidates",
      "read_inbox",
      "place_question",
      "send_signal",
      "draft_talk_link",
    ],
  );
});

test("NO tool accepts a talk body: draft_talk_link takes edgeId ONLY (0013 invariant 1)", () => {
  const t = PORT_TOOLS.find((x) => x.name === "draft_talk_link");
  assert.ok(t);
  const props = Object.keys(
    (t!.inputSchema as { properties: Record<string, unknown> }).properties,
  );
  assert.deepEqual(props, ["edgeId"], "下書き本文の引数は存在しない — # 以降で運ぶ");
  // 説明文も構造を語る（承認 UI で owner が読む文）
  assert.ok(t!.description.includes("渡さない"));
});

test("free-text params exist only where the content is PUBLIC by meaning", () => {
  // place_question.text（公開ボード行）/ title / 名乗り / anchor だけが自由文。
  for (const t of PORT_TOOLS) {
    const props = (t.inputSchema as { properties?: Record<string, Record<string, unknown>> })
      .properties ?? {};
    for (const [key, schema] of Object.entries(props)) {
      if (schema.pattern !== undefined) continue; // ref/id 形 — 自由文でない
      assert.ok(
        ["text", "title", "displayName", "fromName", "anchor"].includes(key),
        `unexpected free-text param: ${t.name}.${key}`,
      );
    }
  }
});

test("read tools are annotated read-only; writes are not", () => {
  const ro = (n: string) =>
    (PORT_TOOLS.find((t) => t.name === n)!.annotations as { readOnlyHint?: boolean })
      .readOnlyHint;
  assert.equal(ro("get_law_and_manifest"), true);
  assert.equal(ro("read_candidates"), true);
  assert.equal(ro("read_inbox"), true);
  assert.equal(ro("draft_talk_link"), true);
  assert.equal(ro("place_question"), false);
  assert.equal(ro("send_signal"), false);
});

// ── 4. caps mirror functions/_meet.ts ──────────────────────────────────────────
// （照合は functions/port/mcp.test.ts 側 — lib から functions を import すると
//   root tsc に workers 型が要るため、型の置き場に合わせて検査の置き場を選ぶ。
//   ここでは値の存在だけ pin する。）

test("schema caps are positive and shaped", () => {
  for (const cap of [PORT_CAP_QUESTION, PORT_CAP_TITLE, PORT_CAP_NAME, PORT_CAP_ANCHOR]) {
    assert.ok(Number.isInteger(cap) && cap > 0);
  }
});

// ── 5. protocol plumbing fail-closed ───────────────────────────────────────────

test("parseRpc: single / batch / garbage", () => {
  const one = parseRpc({ jsonrpc: "2.0", id: 1, method: "ping" });
  assert.ok(one !== null && !one.batch && one.messages.length === 1);
  const batch = parseRpc([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
  ]);
  assert.ok(batch !== null && batch.batch && batch.messages.length === 2);
  assert.equal(parseRpc([]), null, "empty batch is invalid");
  assert.equal(parseRpc("hello"), null);
  assert.equal(parseRpc({ jsonrpc: "1.0", id: 1, method: "ping" }), null);
  assert.equal(parseRpc({ jsonrpc: "2.0", id: 1 }), null, "method required");
  assert.equal(
    parseRpc({ jsonrpc: "2.0", id: { odd: true }, method: "ping" }),
    null,
    "an off-shape id is refused, not silently treated as a notification",
  );
});

test("protocol version: echo when known, latest when unknown", () => {
  assert.equal(negotiateProtocolVersion("2024-11-05"), "2024-11-05");
  assert.equal(
    negotiateProtocolVersion("9999-01-01"),
    MCP_PROTOCOL_VERSIONS[MCP_PROTOCOL_VERSIONS.length - 1],
  );
  assert.equal(
    negotiateProtocolVersion(undefined),
    MCP_PROTOCOL_VERSIONS[MCP_PROTOCOL_VERSIONS.length - 1],
  );
});

test("toolJson / rpcError shapes", () => {
  const ok = toolJson({ a: 1 }) as { content: Array<{ type: string; text: string }> };
  assert.equal(ok.content[0].type, "text");
  assert.deepEqual(JSON.parse(ok.content[0].text), { a: 1 });
  const err = toolJson({ ok: false }, true) as { isError: boolean };
  assert.equal(err.isError, true);
  const e = rpcError(null, -32700, "parse error");
  assert.equal(e.id, null);
  assert.equal(e.error?.code, -32700);
});
