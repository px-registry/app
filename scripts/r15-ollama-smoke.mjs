// R1.5 Ollama lane smoke — two halves:
//   LOCAL : full loop on http://localhost:8788 incl. a REAL generation through
//           the machine's Ollama (no key, no cloud) — proves the lane end-to-end.
//   REMOTE: on the DEPLOYED https origin, the probe only — answers whether the
//           browser permits https-page → http://localhost:11434 (CORS + PNA).
// Prereqs: ollama serve running with OLLAMA_ORIGINS incl. both origins; local
// dev server up; r15 tables wiped + r15-smoke.ps1 seeded (pool has あや).
import { chromium } from "playwright";

const LOCAL = "http://localhost:8788";
const REMOTE = "https://px-r15.pages.dev";
const SHOT_DIR = "C:/Users/User/Desktop/スクショ";

const [, , user, pass] = process.argv; // remote credentials via argv, not source
const results = [];
function check(name, cond) {
  results.push([name, !!cond]);
  console.log((cond ? "OK  " : "NG  ") + name);
}

const SAMPLE = JSON.stringify([
  { kind: "have", title: "古い町家の納屋", text: "改装途中の納屋がひと部屋あいている", tags: ["場所"], private: false },
  { kind: "want", title: "手を動かす相棒", text: "週末に一緒に床を張る人を探している", tags: ["手仕事"], private: false },
]);

const browser = await chromium.launch();

// ── LOCAL: real generation through Ollama ───────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    httpCredentials: { username: "px", password: "local-dev" },
    locale: "ja-JP",
  });
  const page = await ctx.newPage();

  await page.goto(`${LOCAL}/meet/start/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ローカルAI（Ollama）" }).click();
  await page.getByText("つかうモデル（この端末にあるもの）").waitFor({ timeout: 15000 });
  check("local lane probes and lists installed models", true);
  const detected = await page.locator("select.m-field").inputValue();
  console.log("    installed model picked: " + detected);
  check("connected line only after probe", await page.getByText(`つながっています（Ollama（${detected}））。`).isVisible());
  await page.screenshot({ path: `${SHOT_DIR}/r15c-01-ollama-connected.png`, fullPage: true });

  // memory base + publish
  await page.locator("textarea:not([readonly])").last().fill(SAMPLE);
  await page.getByRole("button", { name: "取り込む" }).click();
  await page.getByRole("button", { name: "この2件で確定する" }).click();
  await page.getByText("記憶の下地ができました。").waitFor();
  await page.goto(`${LOCAL}/meet/memory/`, { waitUntil: "networkidle" });
  await page.locator(".m-itemlist .m-item").first().waitFor();
  await page.locator("input.m-field").first().fill("みどり");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "候補に出す", exact: true }).click();
  await page.getByText("2件を候補に出しました。").waitFor();

  // REAL generation — the owner's machine does the inference
  await page.goto(`${LOCAL}/meet/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "提案を受け取る" }).waitFor();
  await page.getByRole("button", { name: "提案を受け取る" }).click();
  // model load + inference can take a while on first run
  await page
    .locator(".m-itemlist .m-item")
    .first()
    .waitFor({ timeout: 180000 })
    .catch(() => {});
  const entries = await page.locator(".m-itemlist .m-item").count();
  check("a generation entry arrived from local inference", entries >= 1);
  const entryText = entries >= 1 ? await page.locator(".m-itemlist .m-item").first().innerText() : "";
  check("entry names the local model", entryText.includes("Ollama"));
  console.log("    entry head: " + entryText.split("\n").slice(0, 3).join(" / "));
  await page.screenshot({ path: `${SHOT_DIR}/r15c-02-ollama-generation.png`, fullPage: true });
  await ctx.close();
}

// ── REMOTE: probe from the deployed https origin (CORS + PNA reality check) ────
{
  if (!user || !pass) {
    console.log("    (remote half skipped — pass BETA user/pass as argv)");
  } else {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      httpCredentials: { username: user, password: pass },
      locale: "ja-JP",
    });
    // Chrome gates public-site → localhost behind a Local Network Access
    // permission prompt; granting it here mirrors a tester clicking 許可.
    // (Denied/undecided, the lane shows the honest unreachable line.)
    await ctx.grantPermissions(["local-network-access"], { origin: REMOTE });
    const page = await ctx.newPage();
    await page.goto(`${REMOTE}/meet/start/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "ローカルAI（Ollama）" }).click();
    const reachable = await page
      .getByText("つかうモデル（この端末にあるもの）")
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    check("DEPLOYED https page reaches localhost Ollama (CORS+PNA)", reachable);
    if (!reachable) {
      const honest = await page.getByText("Ollamaに届きませんでした", { exact: false }).isVisible();
      check("…and the unreachable state is said honestly", honest);
    }
    await page.screenshot({ path: `${SHOT_DIR}/r15c-03-ollama-remote.png`, fullPage: true });
    await ctx.close();
  }
}

await browser.close();
const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "OLLAMA SMOKE: ALL PASSED" : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
