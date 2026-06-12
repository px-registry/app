// R1.5 第4便 smoke — 伏せ字の反転: AI が固有名を見つけて差し出し、owner が
// タップで決める。実 Ollama で配線を通し（品質は問わない・反映を確認）、
// 未接続フォールバックも確認する。実クラウド鍵（Claude）での品質確認は
// Hiroto の first smoke 持ち。
// Prereqs: `npx wrangler pages dev out --port 8788` with .dev.vars; ollama
// serve running. (The pool/server is untouched here — masking is owner-local.)
import { chromium } from "playwright";

const BASE = "http://localhost:8788";
const SHOT_DIR = "C:/Users/User/Desktop/スクショ";

const results = [];
function check(name, cond) {
  results.push([name, !!cond]);
  console.log((cond ? "OK  " : "NG  ") + name);
}

const browser = await chromium.launch();

// ── connected half: detect → offer → ぜんぶ伏せる → propagation → [→ 伏せる] ──
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    httpCredentials: { username: "px", password: "local-dev" },
    locale: "ja-JP",
  });
  const page = await ctx.newPage();

  try {
    await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "ローカルAI（Ollama）" }).click();
    await page.getByText("つかうモデル（この端末にあるもの）").waitFor({ timeout: 15000 });

    await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "項目を足す" }).click();
    const form = page.locator(".m-itemlist .m-form");
    await form.locator("input.m-field").first().fill("PX Boxの配布");
    await form.locator("textarea.m-field").first().fill("Protocol X を仲間に広めたい");

    // trigger: 出す → the AI reads the OUTGOING text; retry by reopening 書き方
    // (a quiet/failed round is retryable by the owner's gesture)
    await form.getByRole("button", { name: "出さない" }).click(); // → 出す
    let offered = false;
    for (let attempt = 0; attempt < 4 && !offered; attempt++) {
      offered = await form
        .getByText("この文には特定につながる言葉がありそうです", { exact: false })
        .waitFor({ timeout: 90000 })
        .then(() => true)
        .catch(() => false);
      if (!offered) {
        console.log(`    (attempt ${attempt + 1}: no offer — reopening 書き方 to retry)`);
        await form.getByText("候補に出すときの書き方").click(); // close
        await form.getByText("候補に出すときの書き方").click(); // reopen → retry
      }
    }
    check("detection offer appears (qwen wiring; quality not judged)", offered);
    const offerText = offered
      ? await form.locator(".m-card", { hasText: "この文には特定につながる言葉" }).innerText()
      : "";
    console.log("    offer: " + offerText.split("\n").slice(1, 2).join(""));
    await page.screenshot({ path: `${SHOT_DIR}/r15f-01-detect-offer.png`, fullPage: true });

    await form.getByRole("button", { name: "ぜんぶ伏せる" }).click();
    await page.waitForTimeout(400);
    const pubText = await form.locator("textarea.m-field").nth(1).inputValue();
    const pubTitle = await form.locator("input.m-field").nth(2).inputValue();
    console.log("    public after mask: " + pubTitle + " / " + pubText);
    check("tap-apply wrote the PUBLIC fields", pubText.trim() !== "" || pubTitle.trim() !== "");
    check(
      "private body untouched",
      (await form.locator("textarea.m-field").first().inputValue()) === "Protocol X を仲間に広めたい",
    );
    check("byproduct list line appears (これまでに伏せた言葉)", await form.getByText("これまでに伏せた言葉", { exact: false }).isVisible());
    await page.screenshot({ path: `${SHOT_DIR}/r15f-02-masked-applied.png`, fullPage: true });
    await form.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForTimeout(400);

    // propagation: a NEW item containing an already-masked word warns
    // deterministically, and [→ 伏せる] one-taps it away (●● default ok)
    const histLine = await page.getByText("これまでに伏せた言葉", { exact: false }).first().innerText().catch(() => "");
    const knownWord = /Protocol X/i.test(histLine) ? "Protocol X" : "PX Box";
    await page.getByRole("button", { name: "項目を足す" }).click();
    const form2 = page.locator(".m-itemlist .m-form");
    await form2.locator("input.m-field").first().fill("続きの話");
    await form2.locator("textarea.m-field").first().fill(`${knownWord} の続きを試したい`);
    await form2.getByRole("button", { name: "出さない" }).click(); // → 出す
    await form2.getByText("伏せたい言葉が残っています", { exact: false }).waitFor({ timeout: 10000 });
    check("byproduct word propagates to a NEW item (deterministic warning)", true);
    await page.screenshot({ path: `${SHOT_DIR}/r15f-03-propagated-warning.png`, fullPage: true });
    await form2.getByRole("button", { name: `「${knownWord}」を伏せる` }).click();
    await page.waitForTimeout(400);
    check(
      "[→ 伏せる] one-tap clears the warning",
      (await form2.locator("p.m-note", { hasText: "伏せたい言葉が残っています" }).count()) === 0,
    );
    const fixedPub = await form2.locator("textarea.m-field").nth(1).inputValue();
    console.log("    one-tap public text: " + fixedPub);
    check("one-tap wrote a public phrasing (word replaced)", !new RegExp(knownWord, "i").test(fixedPub) && fixedPub.trim() !== "");
    await page.screenshot({ path: `${SHOT_DIR}/r15f-04-one-tap-masked.png`, fullPage: true });
  } catch (e) {
    console.log("SMOKE ERROR: " + e.message.split("\n")[0]);
    await page.screenshot({ path: `${SHOT_DIR}/r15f-99-error.png`, fullPage: true }).catch(() => {});
    results.push(["(no exception during connected half)", false]);
  }
  await ctx.close();
}

// ── disconnected half: detection silent, honest hint, manual path intact ─────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    httpCredentials: { username: "px", password: "local-dev" },
    locale: "ja-JP",
  });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "項目を足す" }).click();
    const form = page.locator(".m-itemlist .m-form");
    await form.locator("textarea.m-field").first().fill("Protocol X の試み");
    await form.getByText("候補に出すときの書き方").click();
    check("unconnected: honest hint shown", await form.getByText("AIをつなぐと、固有名の検出と言い換えを手伝えます。").isVisible());
    await form.getByRole("button", { name: "出さない" }).click(); // → 出す
    await page.waitForTimeout(800);
    check(
      "unconnected: no detection runs (no busy, no offer)",
      !(await form.getByText("この文には特定につながる言葉", { exact: false }).isVisible().catch(() => false)) &&
        !(await form.getByText("あなたのAIが読んでいます", { exact: false }).isVisible().catch(() => false)),
    );
    await page.screenshot({ path: `${SHOT_DIR}/r15f-05-unconnected-fallback.png`, fullPage: true });
  } catch (e) {
    console.log("SMOKE ERROR: " + e.message.split("\n")[0]);
    results.push(["(no exception during disconnected half)", false]);
  }
  await ctx.close();
}

await browser.close();
const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "BATCH4 SMOKE: ALL PASSED" : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
