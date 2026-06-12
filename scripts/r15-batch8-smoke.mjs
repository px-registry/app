// R1.5 第8便 smoke — 沈黙の禁止. Captures console + page errors. Phase 1:
// real qwen with Hiroto's exact repro question. Phase 2: the Ollama endpoint
// is MOCKED per failure path (旧形式/散文/fenced []/発明相手/壊れJSON/ネット
// ワーク例外) — after each 探しに行く the screen must show (a) cards,
// (b) 今日は無い (excluded note + raw fold where applicable), or (c) an
// honest error. Silence on any path = NG.
// Prereqs: wrangler dev :8788, ollama serve, tables wiped + r15-smoke.ps1.
import { chromium } from "playwright";

const BASE = "http://localhost:8788";
const HIROTO_Q = "PXとシナジー効果を見込める人物、または会社をさがしている。";

const results = [];
function check(name, cond) {
  results.push([name, !!cond]);
  console.log((cond ? "OK  " : "NG  ") + name);
}

const MEMORY_PASTE = JSON.stringify([
  { kind: "have", title: "古い町家の納屋", text: "改装途中の納屋がひと部屋あいている", tags: ["場所"], private: false },
  { kind: "want", title: "手を動かす相棒", text: "週末に一緒に床を張る人を探している", tags: ["手仕事"], private: false },
]);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  httpCredentials: { username: "px", password: "local-dev" },
  locale: "ja-JP",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 300));
});

// setup: name + ollama + memory
await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
await page.locator("input.m-field").first().fill("さいげん");
await page.getByRole("button", { name: "保存", exact: true }).first().click();
await page.getByText("保存しました").waitFor();
await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "ローカルAI（Ollama）" }).click();
await page.getByText("つかうモデル（この端末にあるもの）").waitFor({ timeout: 15000 });
await page.locator("textarea:not([readonly])").last().fill(MEMORY_PASTE);
await page.getByRole("button", { name: "取り込む" }).click();
await page.getByRole("button", { name: "この2件で確定する" }).click();
await page.getByText("記憶の下地ができました。").waitFor();

async function outcome(prevEntries) {
  // wait until busy clears (up to 180s)
  for (let i = 0; i < 360; i++) {
    const busy = await page.getByText("あなたのAIが読んでいます", { exact: false }).isVisible().catch(() => false);
    if (!busy) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(600);
  // 第9便 A: EVERY ending is a dated entry (が読みました = generation,
  // 探しに行きました = pool-empty/error fact) — an entry IS a visible outcome
  // (the faces are pinned by MA-10/10b). Under-button stays as last resort.
  const entries =
    (await page.locator(".m-item", { hasText: "が読みました" }).count()) +
    (await page.locator(".m-item", { hasText: "探しに行きました" }).count());
  const cards = await page.locator(".m-proposal").count();
  const none = await page.getByText("今日は無い、という日もあります。", { exact: false }).first().isVisible().catch(() => false);
  const err = await page.locator("[aria-live]").allInnerTexts().catch(() => []);
  const honestError = err.some((t) => /ませんでした|もう一度|今日は無い/.test(t));
  return { newEntry: entries > prevEntries, cards, none, honestError, entries };
}

async function countEntries() {
  return (
    (await page.locator(".m-item", { hasText: "が読みました" }).count()) +
    (await page.locator(".m-item", { hasText: "探しに行きました" }).count())
  );
}

async function pressAndJudge(label) {
  const prev = await countEntries();
  await page.getByRole("button", { name: "探しに行く" }).click();
  const o = await outcome(prev);
  const visible = o.newEntry || o.none || o.honestError;
  check(`${label}: outcome visible (a/b/c)`, visible);
  console.log(`    entry+:${o.newEntry} cards:${o.cards} none:${o.none} err:${o.honestError}`);
  return o;
}

// ── phase 1: real qwen, Hiroto's exact question ──────────────────────────────
await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
await page.locator("textarea.m-field").first().fill(HIROTO_Q);
await pressAndJudge("REAL qwen + Hiroto question");
await page.screenshot({ path: "C:/Users/User/Desktop/スクショ/r15j-01-real-qwen.png", fullPage: true });

// ── phase 2: mocked replies, one path at a time ──────────────────────────────
const FIXTURES = [
  ["old-format (no basisItemId)", '```json\n[{"to":"あや","line1":"納屋 × 工房","line2":"週末に一度"}]\n```'],
  ["prose only", "いい相手が見つかりました。あやさんと話すと良いと思います。ぜひご連絡ください。"],
  ["fenced empty", "```json\n[]\n```"],
  ["invented partners", '```json\n[{"to":"AI研究者コミュニティ","line1":"x","line2":"y","basisItemId":"p1"}]\n```'],
  ["broken json", '```json\n[{"to":"あや",'],
];
for (const [label, reply] of FIXTURES) {
  await page.route("**/api/generate", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ response: reply }) }),
  );
  await pressAndJudge(`MOCK ${label}`);
  await page.unroute("**/api/generate");
}
// the all-excluded entry says WHY (excluded note) and keeps the raw readable
check(
  "all-excluded entries carry the excluded note",
  await page.getByText("実在の相手に結べない提案は表示していません", { exact: false }).first().isVisible(),
);
check(
  "raw stays inspectable in the fold",
  (await page.getByText("そのままの返事を見る").count()) >= 1,
);
// network exception path
await page.route("**/api/generate", (route) => route.abort());
await pressAndJudge("MOCK network abort");
await page.unroute("**/api/generate");

await page.screenshot({ path: "C:/Users/User/Desktop/スクショ/r15j-02-fixture-paths.png", fullPage: true });

if (errors.length > 0) {
  console.log("---- captured errors ----");
  for (const e of errors.slice(0, 10)) console.log(e);
}

await browser.close();
const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "SILENCE REPRO: ALL VISIBLE" : `${failed.length} PATH(S) SILENT`);
process.exit(failed.length === 0 ? 0 : 1);
