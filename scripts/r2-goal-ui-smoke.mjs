// R2 GOAL — 一括 GOAL の UI 実機 smoke（playwright・local wrangler dev に当てる）。
//
//   $env:R2_BASE / R2_USER / R2_PASS を設定して: node scripts/r2-goal-ui-smoke.mjs
//   実行前に local D1 を掃除すること。Dock L2 の実生成は local Ollama（配線確認用）。
//
// 検査列:
//   1. 二扉化: /meet/start/ に「このページで使う」「あなたのAIから使う」が同格・
//      接続URLは伏せ表示＋コピー
//   2. pair 面: ノート fold に下書きボタン / 「会ったあとに」(後日談 L0 = そのまま足す)
//   3. 下書きリンク受け: /meet/?room=<edge>#draft=… がトーク欄に入る（サーバ非経由）
//      ＋宛先不明のときの正直な一行
//   4. reverse-import: port の place_question → 次回訪問で端末の記憶に取り込まれる
//   5. Dock L2: ollama 実生成で「探してもらう」一周 — 結果が提案レーンに entry で立つ
//
// スクショ: C:\Users\User\Desktop\スクショ\r2g-NN.png（コミットしない）

import { chromium } from "playwright";

const BASE = process.env.R2_BASE ?? "http://127.0.0.1:8788";
const USER = process.env.R2_USER ?? "";
const PASS = process.env.R2_PASS ?? "";
const SHOTS = "C:\\Users\\User\\Desktop\\スクショ";

const TOK_A = "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1";
const ITEM_ME = "11ee".repeat(4);
const ITEM_A = "22dd".repeat(4);

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures += 1;
    console.log(`  NG  ${name} ${detail}`);
  }
}

const AUTH = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH, Origin: BASE },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function deriveRef(token) {
  const data = new TextEncoder().encode(`px-meet-r15:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
let mcpId = 0;
async function portTool(token, name, args) {
  mcpId += 1;
  const res = await fetch(`${BASE}/port/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: mcpId, method: "tools/call", params: { name, arguments: args } }),
  });
  const body = await res.json().catch(() => null);
  return JSON.parse(body?.result?.content?.[0]?.text ?? "null");
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  httpCredentials: { username: USER, password: PASS },
  viewport: { width: 1180, height: 900 },
});
await ctx.grantPermissions(["local-network-access"]).catch(() => {});
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: `${SHOTS}\\${name}.png`, fullPage: true });

console.log(`goal ui smoke → ${BASE}`);

// ── 0. owner token を mint（home 初訪問）─────────────────────────────────────────
await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
const myToken = await page.evaluate(() => localStorage.getItem("pxmeet:owner-token"));
check("owner token minted", /^[0-9a-f]{32,64}$/.test(myToken ?? ""));
const myRef = await deriveRef(myToken);

// ── 1. 二扉化 ────────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
check("door A heading", await page.getByRole("heading", { name: "このページで使う" }).isVisible());
check("door B heading", await page.getByRole("heading", { name: "あなたのAIから使う" }).isVisible());
check("port URL is masked (合鍵は伏せ表示)", await page.getByText("/port/mcp?k=••••••••").isVisible());
check("copy button enabled", await page.getByRole("button", { name: "接続URLをコピー" }).isEnabled());
await shot("r2g-01-two-doors");

// ── 2. seed → mutual → pair 面（ノート下書きボタン・会ったあとに）────────────────
const pubMe = await api("/api/meet/publish", {
  ownerToken: myToken, displayName: "みどり", intro: "",
  items: [{ itemRef: ITEM_ME, kind: "want", title: "活版印刷", text: "活版の話がしたい", tags: [], position: 0 }],
});
const pubA = await api("/api/meet/publish", {
  ownerToken: TOK_A, displayName: "あや", intro: "納屋で工房",
  items: [{ itemRef: ITEM_A, kind: "have", title: "納屋", text: "古い納屋があります", tags: [], position: 0 }],
});
const EDGE = "edge_" + "12ab".repeat(4);
const sig = await api("/api/meet/signal", {
  ownerToken: TOK_A, toRef: myRef, fromName: "あや", toName: "みどり",
  anchor: "納屋 × 活版印刷", edgeId: EDGE, basisItemRef: ITEM_ME, proposalPtr: "",
});
const tb = await api("/api/meet/talkback", { ownerToken: myToken, edgeId: EDGE });
check("seed: publish×2 + T1 + T2", pubMe.status === 201 && pubA.status === 201 && sig.status === 201 && tb.body?.state === "mutual",
  JSON.stringify([pubMe.status, pubA.status, sig.status, tb.body]));

await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
await page.getByText("この接点で話す").first().waitFor();
await page.locator(".m-notefold summary", { hasText: "ノート" }).first().click();
check("ノート fold に下書きボタン", await page.getByRole("button", { name: "あなたのAIに下書きを頼む" }).first().isVisible());
await page.locator(".m-notefold summary", { hasText: "会ったあとに" }).first().click();
check("後日談 fold が開く", await page.getByText("会ったことを、あなたの記憶に残せます").isVisible());
await page.getByPlaceholder("どうでしたか。何が見つかりましたか。").fill("納屋で会った。活版の話。次は道具を見せてもらう");
await page.getByRole("button", { name: "記憶に足す" }).click();
await page.getByText("記憶に足しました。").waitFor();
check("後日談 L0: そのまま記憶に足せる", true);
await shot("r2g-02-pair-epilogue");

// ── 3. 下書きリンク受け（#draft= はサーバに行かない）────────────────────────────
const apiBodies = [];
page.on("request", (req) => {
  if (req.url().includes("/api/") || req.url().includes("/port/")) apiBodies.push(req.postData() ?? "");
});
const DRAFT = "tripwire-port-draft こんにちは、納屋の件です";
await page.goto(`${BASE}/meet/?room=${EDGE}#draft=${encodeURIComponent(DRAFT)}`, { waitUntil: "networkidle" });
await page.getByText("この接点で話す").first().waitFor();
const talkVal = await page.locator(".m-talk textarea").first().inputValue();
check("下書きがトーク欄に入る", talkVal === DRAFT, talkVal);
check("URL が掃除される（one-shot）", !page.url().includes("room="), page.url());
check("下書きはどの request body にも乗らない", apiBodies.every((b) => !b.includes("tripwire-port-draft")));
await shot("r2g-03-port-draft");

const MISS = "edge_" + "ff".repeat(8);
await page.goto(`${BASE}/meet/?room=${MISS}#draft=${encodeURIComponent("x")}`, { waitUntil: "networkidle" });
await page.getByText("あなたのAIからの下書きが指すトークが、いま見つかりません。").waitFor();
check("宛先不明の正直な一行", true);

// ── 4. reverse-import（port のアンテナ → 端末の記憶へ）──────────────────────────
const placed = await portTool(myToken, "place_question", { text: "近所で味噌づくりを教えてくれる人いませんか" });
check("port: place_question ok", placed?.ok === true, JSON.stringify(placed));
await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
await page.getByText("味噌づくり", { exact: false }).first().waitFor({ timeout: 15000 });
check("アンテナが次回訪問で取り込まれる（置いた問いに立つ）", true);
await shot("r2g-04-antenna-imported");

// ── 5. Dock L2 — ollama 実生成で一周 ─────────────────────────────────────────────
await page.evaluate(() => {
  localStorage.setItem("pxmeet:model", "ollama:qwen2.5-coder:7b");
});
await page.reload({ waitUntil: "networkidle" });
const dockBox = page.getByPlaceholder("どんな人・どんな話を探しますか");
await dockBox.waitFor();
check("Dock 検索が connected 面で出る", await dockBox.isVisible());
await dockBox.fill("納屋や工房を持っている人と、ものづくりの話がしたい");
// プレビュー＝送られるものそのもの（law と届いた提案ブロックが見える）
await page.getByText("あなたのAIに渡す内容を見る").click();
await page.getByText("【出会いの法】").first().waitFor({ timeout: 20000 });
check("プレビューに law が乗る（構成的正直）", true);
const entriesBefore = await page.locator(".m-entry").count();
await page.getByRole("button", { name: "探してもらう", exact: true }).click();
await page.getByText("「AIが見つけた提案」に入ります。").waitFor({ timeout: 240000 });
await page.waitForFunction(
  (n) => document.querySelectorAll(".m-entry").length > n,
  entriesBefore,
  { timeout: 20000 },
);
check("L2: 検索の結末が entry で立つ（沈黙の禁止）", true);
await shot("r2g-05-dock-search");

await browser.close();
console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
