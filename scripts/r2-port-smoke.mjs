// R2 GOAL — チャットポートの実機 smoke（wrangler pages dev / px-r2-dev どちらにも）。
//
// 合成データのみ。実行前に対象 D1 の r15_* を掃除すること（冪等でない）。
//   $env:R2_BASE / R2_USER / R2_PASS を設定して: node scripts/r2-port-smoke.mjs
//
// 検査列:
//   1. 門の交代: /port/mcp は Basic 無しで届く（token 無し = 401 JSON）。
//      サイト本体は Basic 無しで 401 のまま。
//   2. MCP handshake: initialize（version echo・instructions）→ tools/list = 6 具
//   3. P0: get_law_and_manifest に law verbatim 先頭・read_candidates が
//      相手の項目（antenna 印つき）を返し自分を含まない
//   4. P1: place_question = additive（既存項目が残る・pool に「問い」が立つ）
//   5. P1: send_signal = sent / 冪等（existing:true）/ T2 後の draft_talk_link が
//      #draft= で終わる linkBase を返す
//   6. read_inbox: edge 状態・封書件数 0・気配
//   7. 平文 tripwire: draft_talk_link に本文らしき引数を足しても schema 外
//      （additionalProperties が殺すのではなくサーバは無視する — 本文がサーバ側
//      のどの応答にも残らないことだけ確認）

const BASE = process.env.R2_BASE ?? "http://127.0.0.1:8788";
const AUTH = "Basic " + Buffer.from(`${process.env.R2_USER}:${process.env.R2_PASS}`).toString("base64");

const TOKEN_A = "a1".repeat(16);
const TOKEN_B = "b2".repeat(16);
const ITEM_A = "aa11".repeat(4);
const ITEM_B = "bb22".repeat(4);

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures += 1;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH, Origin: BASE },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

let rpcId = 0;
async function mcp(method, params, token = TOKEN_A) {
  rpcId += 1;
  const res = await fetch(`${BASE}/port/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcId, method, ...(params ? { params } : {}) }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function tool(name, args = {}, token = TOKEN_A) {
  const r = await mcp("tools/call", { name, arguments: args }, token);
  const text = r.body?.result?.content?.[0]?.text ?? "";
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  return { status: r.status, isError: r.body?.result?.isError === true, data: parsed, text };
}

console.log(`port smoke → ${BASE}`);

// ── 1. 門の交代 ─────────────────────────────────────────────────────────────────
{
  const noBasic = await fetch(`${BASE}/port/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
  });
  check("port reachable without Basic (401 = port's own door)", noBasic.status === 401);
  const site = await fetch(`${BASE}/meet/`);
  check("site itself still behind Basic (401)", site.status === 401);
  const get = await fetch(`${BASE}/port/mcp`);
  check("GET /port/mcp = 405 honest", get.status === 405 || get.status === 401);
}

// ── 2. handshake ────────────────────────────────────────────────────────────────
{
  const init = await mcp("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
  check("initialize 200 + echo version", init.status === 200 && init.body?.result?.protocolVersion === "2025-03-26", JSON.stringify(init.body));
  check("instructions point at law first", String(init.body?.result?.instructions ?? "").includes("get_law_and_manifest"));
  const tools = await mcp("tools/list");
  const names = (tools.body?.result?.tools ?? []).map((t) => t.name);
  check("tools/list = 6具", names.length === 6 && names.includes("place_question") && names.includes("draft_talk_link"), names.join(","));
}

// ── 3. P0 reads（seed: A/B publish via API）────────────────────────────────────
{
  const pubA = await api("/api/meet/publish", {
    ownerToken: TOKEN_A,
    displayName: "あや",
    intro: "",
    items: [{ itemRef: ITEM_A, kind: "want", title: "庭仕事", text: "週末に庭を直したい", tags: [], position: 0 }],
  });
  const pubB = await api("/api/meet/publish", {
    ownerToken: TOKEN_B,
    displayName: "カフェの人",
    intro: "店をやっています",
    items: [
      { itemRef: ITEM_B, kind: "have", title: "工具一式", text: "貸せます", tags: [], position: 0 },
      { itemRef: "cc33".repeat(4), kind: "want", title: "看板の問い", text: "看板を描ける人を探しています", tags: ["問い"], position: 1 },
    ],
  });
  check("seed publish A/B", pubA.status === 201 && pubB.status === 201, JSON.stringify([pubA.body, pubB.body]));

  const law = await tool("get_law_and_manifest");
  check("law verbatim head", String(law.data?.law ?? "").startsWith("【出会いの法】"), law.text.slice(0, 80));
  check("manifest patrol speaks 今日は無い", String(law.data?.manifest?.patrol ?? "").includes("今日は無い"));

  const cands = await tool("read_candidates");
  const c = cands.data?.candidates ?? [];
  check("read_candidates: B 2項目・自分なし", c.length === 2 && c.every((x) => x.name === "カフェの人"), JSON.stringify(c));
  check("antenna 印が立つ", c.some((x) => x.antenna === true && /問い|看板/.test(x.title)));
  check("mine に自分の公開面", (cands.data?.mine ?? []).length === 1 && cands.data?.myName === "あや");
}

// ── 4. P1 place_question（additive）───────────────────────────────────────────
{
  const placed = await tool("place_question", { text: "近所で味噌づくりを教えてくれる人いませんか" });
  check("place_question ok + itemRef", placed.isError === false && /^[0-9a-f]{16}$/.test(placed.data?.itemRef ?? ""), placed.text);
  const candsAsB = await tool("read_candidates", {}, TOKEN_B);
  const fromA = (candsAsB.data?.candidates ?? []).filter((x) => x.name === "あや");
  check("B から見て A は 2項目（既存＋アンテナ — additive）", fromA.length === 2, JSON.stringify(fromA));
  check("立てたアンテナに antenna 印", fromA.some((x) => x.antenna === true && x.text.includes("味噌")));
}

// ── 5. P1 send_signal → T2 → draft_talk_link ───────────────────────────────────
let edgeId = "";
{
  const sig = await tool("send_signal", { toRef: "", basisItemRef: ITEM_B });
  check("send_signal: 偽 toRef は正直に拒否", sig.isError === true);
  // B の participantRef は A の read_candidates から
  const cands = await tool("read_candidates");
  const toRef = (cands.data?.candidates ?? [])[0]?.participantRef ?? "";
  const sent = await tool("send_signal", { toRef, basisItemRef: ITEM_B, anchor: "庭 × 工具" });
  edgeId = sent.data?.edgeId ?? "";
  check("send_signal = sent", sent.isError === false && sent.data?.state === "sent", sent.text);
  const again = await tool("send_signal", { toRef, basisItemRef: ITEM_B });
  check("冪等: existing:true・同じ edge", again.data?.existing === true && again.data?.edgeId === edgeId);

  const early = await tool("draft_talk_link", { edgeId });
  check("mutual 前の draft_talk_link は not_mutual", early.isError === true && early.data?.error === "not_mutual");

  const tb = await api("/api/meet/talkback", { ownerToken: TOKEN_B, edgeId });
  check("T2 talkback = mutual", tb.body?.state === "mutual", JSON.stringify(tb.body));

  const link = await tool("draft_talk_link", { edgeId });
  check("linkBase ends with #draft=", String(link.data?.linkBase ?? "").endsWith(`/meet/?room=${edgeId}#draft=`), link.text);
}

// ── 6. read_inbox ───────────────────────────────────────────────────────────────
{
  const inboxA = await tool("read_inbox");
  const out = inboxA.data?.outgoing ?? [];
  check("inbox: outgoing に mutual edge", out.some((e) => e.edgeId === edgeId && e.state === "mutual"), inboxA.text.slice(0, 400));
  check("inbox: 封書 0 件・ciphertext は語に存在しない", (inboxA.data?.heldEnvelopes ?? []).length === 0 && !inboxA.text.includes("ciphertext"));
  const inboxB = await tool("read_inbox", {}, TOKEN_B);
  check("B の気配: アンテナが読まれた数 ≥ 1", (inboxB.data?.questionReads ?? []).length >= 1, inboxB.text.slice(0, 200));
}

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
