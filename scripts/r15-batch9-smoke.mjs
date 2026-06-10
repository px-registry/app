// R1.5 第9便 smoke — 見回り / 気配 / 結末の置き場所, real qwen inference.
// Prereqs: wrangler dev :8788 (0009 applied), ollama serve, tables wiped +
// r15-smoke.ps1 seeded (pool = あや/カフェの人).
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
async function viewPool(viewerToken) {
  const me = await deriveRef(viewerToken);
  return fetch(`${BASE}/api/meet/pool?me=${me}`, { headers: { Authorization: AUTH, Origin: BASE } }).then((r) => r.json());
}

const MEMORY_PASTE = JSON.stringify([
  { kind: "have", title: "古い町家の納屋", text: "改装途中の納屋がひと部屋あいている", tags: ["場所"], private: false },
  { kind: "want", title: "手を動かす相棒", text: "週末に一緒に床を張る人を探している", tags: ["手仕事"], private: false },
]);

const browser = await chromium.launch();

// ── connected half ────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    httpCredentials: { username: "px", password: "local-dev" },
    locale: "ja-JP",
  });
  const page = await ctx.newPage();
  try {
    // setup: name + AI + memory + a PLACED question, published
    await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
    await page.locator("input.m-field").first().fill("みまわり");
    await page.getByRole("button", { name: "保存", exact: true }).first().click();
    await page.getByText("保存しました").waitFor();
    await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "ローカルAI（Ollama）" }).click();
    await page.getByText("つかうモデル（この端末にあるもの）").waitFor({ timeout: 15000 });
    await page.locator("textarea:not([readonly])").last().fill(MEMORY_PASTE);
    await page.getByRole("button", { name: "取り込む" }).click();
    await page.getByRole("button", { name: "この2件で確定する" }).click();
    await page.getByText("記憶の下地ができました。").waitFor();
    await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
    await page.locator("textarea.m-field").first().fill("週末に納屋を直す相棒を探したい");
    await page.getByRole("button", { name: "置いておく" }).click();
    await page.getByRole("button", { name: "この内容で置く" }).click();
    await page.getByRole("button", { name: "候補を更新する" }).click();
    await page.getByText("待っています。").waitFor({ timeout: 10000 });

    // ── 気配: participant count is a live fact ─────────────────────────────────
    check("participants count shown", await page.getByText("いま候補に出ている参加者：", { exact: false }).isVisible());

    // ── B. RELOAD → the patrol runs ONCE, quietly, and lands as an entry ──────
    await page.reload({ waitUntil: "networkidle" });
    const patrolEntry = page.locator(".m-item", { hasText: "の見回り" }).first();
    await patrolEntry.waitFor({ timeout: 240000 });
    check("patrol ran on open and landed as an entry with provenance", true);
    const provenance = await patrolEntry.locator(".m-item-tags").nth(1).innerText();
    console.log("    provenance: " + provenance);
    check("provenance names the placed question", provenance.includes("置いた問い"));
    check("最後の見回り line appears", await page.getByText("最後の見回り：", { exact: false }).isVisible());
    await page.screenshot({ path: `${SHOT_DIR}/r15k-01-patrol-entry.png`, fullPage: true });

    // ── throttle: a second open within 6h does NOT patrol again ───────────────
    const before = await page.locator(".m-item", { hasText: "の見回り" }).count();
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(6000);
    const after = await page.locator(".m-item", { hasText: "の見回り" }).count();
    check("6h throttle: reopening does not patrol again", after === before);
    check("…and no 見回り中 indicator", !(await page.getByText("見回り中…").isVisible().catch(() => false)));

    // ── C. reads count: distinct viewers, dedup'd per day ─────────────────────
    await viewPool("77777777777777777777777777777777"); // viewer 1
    await viewPool("77777777777777777777777777777777"); // viewer 1 again (dedup)
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("1人のAIに読まれました", { exact: false }).waitFor({ timeout: 10000 });
    check("read count = 1 after one distinct viewer (repeat dedup'd)", true);
    await viewPool("88888888888888888888888888888888"); // viewer 2
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("2人のAIに読まれました", { exact: false }).waitFor({ timeout: 10000 });
    check("read count = 2 after a second distinct viewer", true);
    await page.screenshot({ path: `${SHOT_DIR}/r15k-02-reads-count.png`, fullPage: true });
  } catch (e) {
    console.log("SMOKE ERROR: " + e.message.split("\n")[0]);
    await page.screenshot({ path: `${SHOT_DIR}/r15k-99-error.png`, fullPage: true }).catch(() => {});
    results.push(["(no exception during connected half)", false]);
  }
  await ctx.close();
}

// ── disconnected half: honest copy, no patrol, empty-state branches ───────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    httpCredentials: { username: "px", password: "local-dev" },
    locale: "ja-JP",
  });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
    check("empty state (no memory): 記憶の下地…", await page.getByText("記憶の下地ができたら", { exact: false }).isVisible());
    // placing a question needs no AI — and creates a memory item
    await page.locator("textarea.m-field").first().fill("静かな問いをひとつ");
    await page.getByRole("button", { name: "置いておく" }).click();
    await page.getByRole("button", { name: "この内容で置く" }).click();
    await page.getByRole("heading", { name: "置いてある問い" }).waitFor();
    check("unconnected: patrol copy shown on 置いてある問い", await page.getByText("見回りは、この端末でAIがつながっているときに動きます。").isVisible());
    check("empty state (ready): 問いを書いて…", await page.getByText("まだ何もありません。問いを書いて", { exact: false }).isVisible());
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    check("unconnected: no patrol runs", !(await page.getByText("見回り中…").isVisible().catch(() => false)) &&
      (await page.locator(".m-item", { hasText: "の見回り" }).count()) === 0);
    await page.screenshot({ path: `${SHOT_DIR}/r15k-03-unconnected.png`, fullPage: true });
  } catch (e) {
    console.log("SMOKE ERROR: " + e.message.split("\n")[0]);
    results.push(["(no exception during disconnected half)", false]);
  }
  await ctx.close();
}

await browser.close();
const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "BATCH9 SMOKE: ALL PASSED" : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
