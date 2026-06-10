// R1.5 第3便 smoke — provenance gate / 読みの自動保存 / 伏せたい言葉, on the
// real app against wrangler local D1 with REAL Ollama inference.
// Prereqs: `npx wrangler pages dev out --port 8788` with .dev.vars; r15_*
// tables WIPED AND NOT SEEDED (phase 1 needs an empty pool — this script seeds
// あや/カフェの人 itself before phase 2); ollama serve running.
import { chromium } from "playwright";

const BASE = "http://localhost:8788";
const SHOT_DIR = "C:/Users/User/Desktop/スクショ";
const AUTH = "Basic " + Buffer.from("px:local-dev").toString("base64");

const results = [];
function check(name, cond) {
  results.push([name, !!cond]);
  console.log((cond ? "OK  " : "NG  ") + name);
}
async function api(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: AUTH, Origin: BASE },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// A want is included deliberately: the law is 両得 — with no owner want, a
// faithful model SHOULD say 今日は無い (observed), and the gate isn't exercised.
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

try {
  // ── setup: name + Ollama + one memory item (ready, but the pool is EMPTY) ───
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.locator("input.m-field").first().fill("ためすひと");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.getByText("保存しました").waitFor({ timeout: 5000 });
  await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ローカルAI（Ollama）" }).click();
  await page.getByText("つかうモデル（この端末にあるもの）").waitFor({ timeout: 15000 });
  await page.locator("textarea:not([readonly])").last().fill(MEMORY_PASTE);
  await page.getByRole("button", { name: "取り込む" }).click();
  await page.getByRole("button", { name: "この2件で確定する" }).click();
  await page.getByText("記憶の下地ができました。").waitFor();

  // ── A-1. EMPTY pool → no generation at all, honest two lines ────────────────
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  check("home heading is the tagline", await page.getByRole("heading", { name: "お互いの記憶から、思いがけない接点を。" }).isVisible());
  await page.getByRole("button", { name: "探しに行く" }).click();
  await page.getByText("いまは候補に出ている参加者がいません。").waitFor({ timeout: 10000 });
  check("pool-0 short circuit: 今日は無い + 補足 (no model run)", await page.getByText("今日は無い、という日もあります。", { exact: false }).isVisible());
  check("no proposal entry was created", (await page.locator(".m-item", { hasText: "が読みました" }).count()) === 0);
  await page.screenshot({ path: `${SHOT_DIR}/r15e-03-pool-empty-short-circuit.png`, fullPage: true });

  // ── A-2. real pool → cards display ONLY for real addressees ─────────────────
  const TOK_A = "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1";
  const TOK_B = "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2";
  await api("/api/meet/publish", { ownerToken: TOK_A, displayName: "あや", items: [
    { kind: "have", title: "活版印刷の工房", text: "古い手キンで小ロット印刷ができる", tags: ["手仕事"], position: 0 },
    { kind: "want", title: "子どもと作る場", text: "親子で手を動かす時間をつくりたい", tags: ["親子"], position: 1 },
  ] });
  await api("/api/meet/publish", { ownerToken: TOK_B, displayName: "カフェの人", items: [
    { kind: "have", title: "昼だけのカフェ", text: "平日昼に間借りで開けている", tags: ["飲食"], position: 0 },
    { kind: "want", title: "夜の使い手", text: "夜の時間に店を活かしたい", tags: ["場所"], position: 1 },
  ] });

  let cardCount = 0;
  for (let attempt = 1; attempt <= 3 && cardCount === 0; attempt++) {
    await page.getByRole("button", { name: "探しに行く" }).click();
    await page
      .locator(".m-item", { hasText: "が読みました" })
      .first()
      .waitFor({ timeout: 180000 });
    cardCount = await page.locator(".m-item .m-proposal").count();
    if (cardCount === 0) console.log(`    (attempt ${attempt}: 今日は無い — retrying)`);
  }
  check("a generation produced displayable cards", cardCount > 0);
  const titles = await page.locator(".m-item .m-proposal .m-item-title").allInnerTexts();
  console.log("    card addressees: " + titles.join(" / "));
  check(
    "every DISPLAYED card resolves to a real pool participant (provenance gate)",
    titles.length > 0 && titles.every((t) => t === "あや" || t === "カフェの人"),
  );
  const bodyText = await page.locator("body").innerText();
  check("no raw fence on screen", !bodyText.includes("```"));

  // ── D. readings auto-save: chip tap → 記録しました (no save button) ──────────
  check("no 残す button exists", (await page.getByRole("button", { name: "残す", exact: true }).count()) === 0);
  check("test-record line above chips", await page.getByText("この読みはテストの記録です。", { exact: false }).first().isVisible());
  await page.locator(".m-proposal .m-chip-pick", { hasText: "面白い" }).first().click();
  await page.getByText("記録しました").first().waitFor({ timeout: 10000 });
  check("chip tap auto-saves (記録しました)", true);
  await page.locator(".m-proposal input.m-field").first().fill("具体的でよい");
  await page.locator(".m-proposal input.m-field").first().blur();
  await page.waitForTimeout(1200); // debounce + roundtrip
  check("note blur auto-saves", await page.getByText("記録しました").first().isVisible());
  await page.screenshot({ path: `${SHOT_DIR}/r15e-04-readings-autosave.png`, fullPage: true });

  // ── E (第4便で反転): 伏せ語の検出→差し出し→適用は scripts/r15-batch4-smoke.mjs
} catch (e) {
  console.log("SMOKE ERROR: " + e.message.split("\n")[0]);
  await page.screenshot({ path: `${SHOT_DIR}/r15e-99-error.png`, fullPage: true }).catch(() => {});
  results.push(["(no exception during smoke)", false]);
}

await browser.close();
const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "BATCH3 SMOKE: ALL PASSED" : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
