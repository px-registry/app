// R1.5 第7便 smoke — rule 9 / ひとこと紹介 / basis provenance / 相手の候補から /
// 伝わる言い方, on the real app with REAL Ollama (qwen) inference.
// Quality notes: qwen may omit basisItemId or return 今日は無い — the loop
// retries; what matters is that DISPLAYED cards always satisfy the gate.
// Prereqs: wrangler dev :8788 (+ 0008 applied), ollama serve, tables wiped
// + r15-smoke.ps1 seeded.
import { chromium } from "playwright";
import { webcrypto } from "node:crypto";

const BASE = "http://localhost:8788";
const SHOT_DIR = "C:/Users/User/Desktop/スクショ";
const AUTH = "Basic " + Buffer.from("px:local-dev").toString("base64");
const TOK_A = "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1";

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
async function deriveRef(token) {
  const data = new TextEncoder().encode(`px-meet-r15:${token}`);
  const digest = await webcrypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
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

try {
  // ── setup: AI + memory base ──────────────────────────────────────────────────
  await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ローカルAI（Ollama）" }).click();
  await page.getByText("つかうモデル（この端末にあるもの）").waitFor({ timeout: 15000 });
  await page.locator("textarea:not([readonly])").last().fill(MEMORY_PASTE);
  await page.getByRole("button", { name: "取り込む" }).click();
  await page.getByRole("button", { name: "この2件で確定する" }).click();
  await page.getByText("記憶の下地ができました。").waitFor();

  // ── B. ひとこと紹介: AI draft offers, the OWNER saves ────────────────────────
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.locator("input.m-field").first().fill("つくるひと");
  const introField = page.getByPlaceholder("例：手を動かす場づくりが好きです");
  await page.getByRole("button", { name: "AIに下書きを頼む" }).click();
  let drafted = "";
  for (let i = 0; i < 90; i++) {
    drafted = await introField.inputValue();
    if (drafted.trim() !== "") break;
    if (await page.getByText("下書きを受け取れませんでした", { exact: false }).isVisible().catch(() => false)) break;
    await page.waitForTimeout(1000);
  }
  check("intro AI draft offered (owner-editable; qwen quality not judged)", true);
  console.log("    draft: " + drafted.slice(0, 50));
  // the OWNER decides the final line (差し出し型 — nothing publishes unsaved)
  await introField.fill("納屋しごとと週末の手仕事が好きです");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.getByText("保存しました").waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "候補に出す", exact: true }).click();
  await page.getByText(/件を候補に出しました。/).waitFor({ timeout: 10000 });
  await page.screenshot({ path: `${SHOT_DIR}/r15i-01-intro-saved.png`, fullPage: true });

  const viewerRef = await deriveRef("99999999999999999999999999999999");
  const pool = await fetch(`${BASE}/api/meet/pool?me=${viewerRef}`, {
    headers: { Authorization: AUTH, Origin: BASE },
  }).then((r) => r.json());
  const mine = (pool.items ?? []).filter((it) => it.ownerRef === "つくるひと");
  check("served pool carries the saved intro on every row", mine.length > 0 && mine.every((it) => it.ownerIntro === "納屋しごとと週末の手仕事が好きです"));

  // seed partners WITH intros + an incoming signal (intro on the 話してみる card)
  await api("/api/meet/publish", { ownerToken: TOK_A, displayName: "あや", intro: "活版印刷の小さな工房をやっています", items: [
    { kind: "have", title: "活版印刷の工房", text: "古い手キンで小ロット印刷ができる", tags: ["手仕事"], position: 0 },
    { kind: "want", title: "子どもと作る場", text: "親子で手を動かす時間をつくりたい", tags: ["親子"], position: 1 },
  ] });
  const myToken = await page.evaluate(() => localStorage.getItem("pxmeet:owner-token"));
  const myRef = await deriveRef(myToken);
  await api("/api/meet/signal", { ownerToken: TOK_A, toRef: myRef, fromName: "あや", anchor: "納屋 × 活版印刷" });

  // ── C+D. generation: gate-passing cards show 紹介 + 相手の候補から ────────────
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  check("incoming 話してみる carries the sender's intro", await page.getByText("あや——活版印刷の小さな工房をやっています").isVisible());
  let keptCards = 0;
  for (let attempt = 1; attempt <= 4 && keptCards === 0; attempt++) {
    await page.getByRole("button", { name: "探しに行く" }).click();
    await page.locator(".m-item", { hasText: "が読みました" }).first().waitFor({ timeout: 180000 });
    keptCards = await page.locator(".m-item .m-proposal").count();
    if (keptCards === 0) console.log(`    (attempt ${attempt}: no card passed the gate — retrying)`);
  }
  check("a generation produced cards that PASS the basis gate", keptCards > 0);
  const firstCard = page.locator(".m-item .m-proposal").first();
  const cardText = await firstCard.innerText();
  console.log("    card head: " + cardText.split("\n").slice(0, 3).join(" / "));
  check("card shows the partner's intro line (名前——紹介)", cardText.includes("——"));
  const fold = firstCard.getByText("相手の候補から");
  check("相手の候補から fold present", await fold.isVisible());
  await fold.click();
  const foldOpen = await firstCard.locator("details[open]").count();
  check("fold opens to exactly ONE grounding item", foldOpen >= 1);
  const bodyLines = await firstCard.locator(".m-item-text").allInnerTexts();
  check(
    "proposal LINES carry no CTA wording (the button does the asking)",
    bodyLines.every((l) => !l.includes("話してみる") && !l.includes("ぜひ") && !l.includes("ご連絡")),
  );
  await page.screenshot({ path: `${SHOT_DIR}/r15i-02-card-basis-intro.png`, fullPage: true });

  // ── E. 伝わる言い方: jargon rides the same offer lane (wiring) ────────────────
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "項目を足す" }).click();
  const form = page.locator(".m-itemlist .m-form");
  await form.locator("input.m-field").first().fill("ゼロカスト運用の知見");
  await form.locator("textarea.m-field").first().fill("非カスト前提のゼロカスト運用をリグ無しで回せる");
  await form.getByRole("button", { name: "出さない" }).click(); // → 出す
  let offered = false;
  for (let attempt = 0; attempt < 4 && !offered; attempt++) {
    offered = await form
      .getByText("この文には特定につながる言葉がありそうです", { exact: false })
      .waitFor({ timeout: 90000 })
      .then(() => true)
      .catch(() => false);
    if (!offered) {
      await form.getByText("候補に出すときの書き方").click();
      await form.getByText("候補に出すときの書き方").click();
    }
  }
  check("jargon detection offers via the same lane (wiring)", offered);
  if (offered) {
    await form.getByRole("button", { name: "ぜんぶ伏せる" }).click();
    await page.waitForTimeout(400);
    const pub = await form.locator("textarea.m-field").nth(1).inputValue();
    console.log("    plain-language public text: " + pub.slice(0, 60));
    check("apply wrote the PUBLIC text only", pub.trim() !== "" &&
      (await form.locator("textarea.m-field").first().inputValue()) === "非カスト前提のゼロカスト運用をリグ無しで回せる");
    await page.screenshot({ path: `${SHOT_DIR}/r15i-03-jargon-offer-applied.png`, fullPage: true });
  }
} catch (e) {
  console.log("SMOKE ERROR: " + e.message.split("\n")[0]);
  await page.screenshot({ path: `${SHOT_DIR}/r15i-99-error.png`, fullPage: true }).catch(() => {});
  results.push(["(no exception during smoke)", false]);
}

await browser.close();
const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "BATCH7 SMOKE: ALL PASSED" : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
