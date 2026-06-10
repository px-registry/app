// R1.5 第2便 smoke — 問いを置く / 公開用の書き方 / parse 頑健化, on the real app
// against wrangler local D1 (+ real Ollama inference for the AI parts).
// Prereqs: `npx wrangler pages dev out --port 8788` with .dev.vars; r15_* tables
// wiped + scripts/r15-smoke.ps1 run once (pool seeded); ollama serve running.
import { chromium } from "playwright";
import { webcrypto } from "node:crypto";

const BASE = "http://localhost:8788";
const SHOT_DIR = "C:/Users/User/Desktop/スクショ";
const AUTH = "Basic " + Buffer.from("px:local-dev").toString("base64");

const results = [];
function check(name, cond) {
  results.push([name, !!cond]);
  console.log((cond ? "OK  " : "NG  ") + name);
}

async function deriveRef(token) {
  const data = new TextEncoder().encode(`px-meet-r15:${token}`);
  const digest = await webcrypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Served pool as an UNINVOLVED viewer sees it (their own ref ≠ publisher's). */
async function fetchPoolAsViewer() {
  const me = await deriveRef("99999999999999999999999999999999");
  const res = await fetch(`${BASE}/api/meet/pool?me=${me}`, {
    headers: { Authorization: AUTH, Origin: BASE },
  });
  return res.json();
}

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  httpCredentials: { username: "px", password: "local-dev" },
  locale: "ja-JP",
});
const page = await ctx.newPage();

try {
  // ── 0. name + local AI lane (Ollama — the owner's real AI) ───────────────────
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.locator("input.m-field").first().fill("といのひと");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.getByText("保存しました").waitFor({ timeout: 5000 });
  await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ローカルAI（Ollama）" }).click();
  await page.getByText("つかうモデル（この端末にあるもの）").waitFor({ timeout: 15000 });

  // ── A. 問いを置く → 確定 → 候補を更新する → 待っています ───────────────────────
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  check("home heading is 問い (今日の dropped)", await page.getByRole("heading", { name: "問い", exact: true }).isVisible());
  check("two-tense line shown", await page.getByText("いま聞くか、置いて待つか", { exact: false }).isVisible());
  const QUESTION = "週末に一緒に古い納屋を直す相棒を探したい";
  await page.locator("textarea.m-field").first().fill(QUESTION);
  await page.getByRole("button", { name: "置いておく" }).click();
  await page.getByText("問いを置く").waitFor();
  const draftTitle = await page.locator(".m-card input.m-field").first().inputValue();
  check("title draft auto-shortened, editable", draftTitle.length > 0 && draftTitle.length <= 17);
  console.log("    draft title: " + draftTitle);
  await page.screenshot({ path: `${SHOT_DIR}/r15d-01-place-confirm.png`, fullPage: true });
  await page.getByRole("button", { name: "この内容で置く" }).click();
  await page.getByRole("heading", { name: "置いてある問い" }).waitFor();
  check("placed list appears; question box cleared", (await page.locator("textarea.m-field").first().inputValue()) === "");
  check("state: まだ候補に出ていません", await page.getByText("まだ候補に出ていません", { exact: false }).isVisible());
  await page.getByRole("button", { name: "候補を更新する" }).click();
  await page.getByText("待っています。").waitFor({ timeout: 10000 });
  check("state after update: 待っています", true);
  await page.screenshot({ path: `${SHOT_DIR}/r15d-02-placed-waiting.png`, fullPage: true });

  // the placed hand is visible to ANOTHER participant's AI (served pool)
  const pool1 = await fetchPoolAsViewer();
  const placedRow = (pool1.items ?? []).find((it) => it.kind === "want" && it.tags.includes("問い") && it.text === QUESTION);
  check("placed question reaches another participant's pool (want + 問い tag)", !!placedRow);

  // ── B. 公開用の書き方 — private body never serves; AI 伏せ版 drafts it ─────────
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "項目を足す" }).click();
  const form = page.locator(".m-itemlist .m-form");
  await form.locator("input.m-field").first().fill("○○株式会社のCS部門");
  await form.locator("textarea.m-field").first().fill("社外秘のCS立ち上げの経緯と社名入りの実績");
  await form.getByText("候補に出すときの書き方").click();

  // AI 下書き (real Ollama inference; owner edits afterwards — here we accept it)
  await form.getByRole("button", { name: "伏せ版を下書き" }).click();
  let aiText = "";
  for (let i = 0; i < 180; i++) {
    aiText = await form.locator("textarea.m-field").nth(1).inputValue();
    if (aiText.trim() !== "") break;
    const honest = await form
      .getByText("下書きを受け取れませんでした", { exact: false })
      .isVisible()
      .catch(() => false);
    if (honest) break; // fail-closed surface — the check below reports it
    await page.waitForTimeout(1000);
  }
  const aiTitle = await form.locator("input.m-field").nth(2).inputValue();
  check("AI 伏せ版 drafted both fields (owner-editable)", aiText.trim() !== "");
  console.log("    masked title: " + aiTitle);
  console.log("    masked text : " + aiText.slice(0, 60));
  // we keep a deterministic public text for the leak check
  await form.locator("textarea.m-field").nth(1).fill("BtoB SaaS の CS 立ち上げ経験");
  await form.locator("input.m-field").nth(2).fill("CS 立ち上げの経験");
  await form.getByRole("button", { name: "出さない" }).click(); // → 出す
  check("顔 preview says which words go out", await form.getByText("候補に出るのはこの文です", { exact: false }).isVisible());
  const preview = await form.locator("p.m-note", { hasText: "候補に出るのはこの文です" }).innerText();
  check("preview shows the PUBLIC phrasing", preview.includes("BtoB SaaS") && !preview.includes("社外秘"));
  await page.screenshot({ path: `${SHOT_DIR}/r15d-03-public-writing-form.png`, fullPage: true });
  await form.getByRole("button", { name: "保存", exact: true }).click();
  const badge = page.getByText("候補に出る書き方", { exact: false }).first();
  const badgeShown = await badge
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check("list badge shows the outgoing phrasing", badgeShown);
  await page.getByRole("button", { name: /候補(に出す|を更新する)/ }).last().click();
  await page.getByText(/件を候補に出しました。/).waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${SHOT_DIR}/r15d-04-public-writing-published.png`, fullPage: true });

  const pool2 = await fetchPoolAsViewer();
  const flat = JSON.stringify(pool2);
  check("served pool carries the public phrasing", flat.includes("BtoB SaaS の CS 立ち上げ経験"));
  check("private title NEVER serves", !flat.includes("○○株式会社"));
  check("private text NEVER serves", !flat.includes("社外秘"));

  // ── C. generation: fenced replies render honestly (no raw ``` on screen) ─────
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "いま聞く" }).waitFor();
  await page.getByRole("button", { name: "いま聞く" }).click();
  // the home now has TWO item lists (置いてある問い + 届いた提案) — scope to a
  // proposal entry by its model line
  const entry = page.locator(".m-item", { hasText: "が読みました" }).first();
  await entry.waitFor({ timeout: 180000 });
  const entryText = await entry.innerText();
  check("a generation entry arrived (placed hand fed the prompt as a want)", entryText.includes("Ollama"));
  check("no raw code fence on screen (今日は無い or cards)", !entryText.includes("```"));
  console.log("    entry head: " + entryText.split("\n").slice(0, 3).join(" / "));
  await page.screenshot({ path: `${SHOT_DIR}/r15d-05-generation-honest.png`, fullPage: true });
} catch (e) {
  console.log("SMOKE ERROR: " + e.message);
  await page.screenshot({ path: `${SHOT_DIR}/r15d-99-error.png`, fullPage: true }).catch(() => {});
  results.push(["(no exception during smoke)", false]);
}

await browser.close();
const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "BATCH2 SMOKE: ALL PASSED" : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
