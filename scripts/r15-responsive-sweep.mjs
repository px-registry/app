// One-off 第5便 visual sweep (not committed): seed real content once, then
// screenshot every surface at 360/768/1024/1440 and assert no horizontal
// overflow (the broken-layout proxy). Mobile widths must look unchanged.
import { chromium } from "playwright";

const BASE = "http://localhost:8788";
const SHOT_DIR = "C:/Users/User/Desktop/スクショ";
const WIDTHS = [360, 768, 1024, 1440];

const results = [];
function check(name, cond) {
  results.push([name, !!cond]);
  console.log((cond ? "OK  " : "NG  ") + name);
}

const MEMORY_PASTE = JSON.stringify([
  { kind: "have", title: "古い町家の納屋", text: "改装途中の納屋がひと部屋あいている", tags: ["場所"], private: false },
  { kind: "want", title: "手を動かす相棒", text: "週末に一緒に床を張る人を探している", tags: ["手仕事"], private: false },
  { kind: "memory", title: "原点", text: "祖母の縁側で育った", tags: [], private: true },
]);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  httpCredentials: { username: "px", password: "local-dev" },
  locale: "ja-JP",
});
const page = await ctx.newPage();

// ── seed content through the real flow (name, AI, memory, place, generate) ──
await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
await page.locator("input.m-field").first().fill("ひろびろ");
await page.getByRole("button", { name: "保存", exact: true }).first().click();
await page.getByText("保存しました").waitFor();
await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "ローカルAI（Ollama）" }).click();
await page.getByText("つかうモデル（この端末にあるもの）").waitFor({ timeout: 15000 });
await page.locator("textarea:not([readonly])").last().fill(MEMORY_PASTE);
await page.getByRole("button", { name: "取り込む" }).click();
await page.getByRole("button", { name: "この3件で確定する" }).click();
await page.getByText("記憶の下地ができました。").waitFor();
await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
await page.locator("textarea.m-field").first().fill("週末に納屋を直す相棒を探したい");
await page.getByRole("button", { name: "置いておく" }).click();
await page.getByRole("button", { name: "この内容で置く" }).click();
await page.getByRole("heading", { name: "置いてある問い" }).waitFor();
await page.getByRole("button", { name: "候補を更新する" }).click();
await page.getByText("待っています。").waitFor({ timeout: 10000 });
await page.getByRole("button", { name: "探しに行く" }).click();
await page.locator(".m-item", { hasText: "が読みました" }).first().waitFor({ timeout: 180000 });

// ── sweep widths × surfaces ───────────────────────────────────────────────────
async function overflow() {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w, height: 900 });
  for (const [route, label] of [
    ["/meet/", "home"],
    ["/meet/memory/", "memory"],
    ["/meet/start/", "start"],
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const ov = await overflow();
    check(`${label}@${w}: no horizontal overflow (${ov}px)`, ov <= 1);
    await page.screenshot({ path: `${SHOT_DIR}/r15g-${label}-${w}.png`, fullPage: true });
  }
  // host (key-gated): open per width
  await page.goto(`${BASE}/meet/host/`, { waitUntil: "networkidle" });
  await page.locator("input[type=password]").fill("host-local");
  await page.getByRole("button", { name: "開く", exact: true }).click();
  await page.getByRole("heading", { name: "候補プール" }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(200);
  const ov = await overflow();
  check(`host@${w}: no horizontal overflow (${ov}px)`, ov <= 1);
  await page.screenshot({ path: `${SHOT_DIR}/r15g-host-${w}.png`, fullPage: true });
}

await browser.close();
const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "RESPONSIVE SWEEP: ALL PASSED" : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
