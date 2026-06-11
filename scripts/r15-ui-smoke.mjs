// R1.5 UI smoke (fix1 / r15b) — drives the real app in a mobile viewport
// against wrangler local D1, and saves screenshots to the desktop.
//
// Prereqs: `npx wrangler pages dev out --port 8788` running, with .dev.vars
// BETA_USER=px BETA_PASS=local-dev FACILITATOR_KEY=host-local, r15_* tables
// wiped, and scripts/r15-smoke.ps1 run once (seeds あや/カフェの人 + a mutual
// pair + one log row).
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
async function waitCheck(name, locator) {
  try {
    await locator.waitFor({ timeout: 15000 });
    check(name, true);
  } catch {
    check(name, false);
  }
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
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const SAMPLE = JSON.stringify([
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
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await ctx.newPage();
const shot = (name) => page.screenshot({ path: `${SHOT_DIR}/r15b-${name}.png`, fullPage: true });

try {
  // 1. home — first visit: prerequisites + AI-less reassurance + open promise
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  // 視覚一新: the hero heading replaced the 題字（旧題字文言は c9-1 で画面から退いた）
  await waitCheck("home renders the hero heading", page.getByRole("heading", { name: /あなたのAIが、あなたの人を見つける/ }));
  await waitCheck("home lists missing steps", page.getByText("AIがまだつながっていません"));
  await waitCheck("AI-less loop reassurance shown", page.getByText("AIをつながなくても", { exact: false }));
  await waitCheck("promise open on first visit", page.getByText("PXはAIを実行しません", { exact: false }));
  await shot("01-home-first-visit");

  // 2. nav: 公開 tab is gone; /meet/pool/ is dead
  check("nav has no 公開 tab", (await page.locator(".m-nav-item", { hasText: "公開" }).count()) === 0);
  const poolRes = await fetch(`${BASE}/meet/pool/`, { headers: { Authorization: AUTH } });
  check("/meet/pool/ no longer serves (404)", poolRes.status === 404);

  // 3. はじめかた — key auto-detect + cold-start intake
  await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
  check("promise collapsed on later visits", !(await page.getByText("PXはAIを実行しません").isVisible()));
  const keyInput = page.locator("input[type=password]");
  await keyInput.fill("sk-proj-smoke-openai");
  await waitCheck("sk-… detected as OpenAI", page.getByText("OpenAI につながります。"));
  await keyInput.fill("sk-ant-local-smoke");
  await waitCheck("sk-ant-… detected as Claude", page.getByText("Claude（Anthropic） につながります。"));
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await waitCheck("connected with internal default model", page.getByText("つながっています（Claude Sonnet 4.6）。"));
  check("key links visible", await page.getByText("鍵の取得：").isVisible());
  await shot("02-start-key-autodetect");

  await page.getByRole("button", { name: "プロンプトをコピー" }).click();
  await waitCheck("copy flips to コピーしました", page.getByText("コピーしました"));
  await page.locator("textarea:not([readonly])").last().fill(SAMPLE);
  await page.getByRole("button", { name: "取り込む" }).click();
  await page.getByRole("button", { name: "この3件で確定する" }).waitFor();
  check("review shows 3 items", (await page.locator(".m-item").count()) === 3);
  check("private item shows 出さない", (await page.locator(".m-toggle:not(.m-toggle-on)").count()) === 1);
  await shot("03-intake-review");
  await page.getByRole("button", { name: "この3件で確定する" }).click();
  await waitCheck("intake done", page.getByText("記憶の下地ができました。"));

  // 4. memory — name, 候補に出す
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.locator(".m-itemlist .m-item").first().waitFor();
  check("memory lists 3 items", (await page.locator(".m-itemlist .m-item").count()) === 3);
  await page.locator("input.m-field").first().fill("みどり");
  // .first(): the memory page now carries a second 保存 (伏せたい言葉)
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.getByRole("button", { name: "候補に出す", exact: true }).waitFor();
  await page.getByRole("button", { name: "候補に出す", exact: true }).click();
  await page.getByText("2件を候補に出しました。").waitFor();
  check("候補に出す pushes 2 items", true);
  await shot("04-memory-published");

  // 5. fix1-1 regression: ADD an item AFTER publishing → banner → update → served
  await page.getByRole("button", { name: "項目を足す" }).click();
  await page.locator(".m-form input.m-field").first().fill("週末の手伝い");
  // .first(): the form now carries a second textarea (候補に出すときの書き方)
  await page.locator(".m-form textarea.m-field").first().fill("日曜の午前なら体が空いている");
  await page.locator(".m-form .m-toggle").click(); // 出さない → 出す
  await page.locator(".m-form").getByRole("button", { name: "保存", exact: true }).click();
  await waitCheck("未反映バナー appears", page.getByText("候補の変更が1件あります", { exact: false }));
  await shot("05-pending-banner");
  // both the banner and the publish card offer the update — press the banner's
  await page.getByRole("button", { name: "候補を更新する" }).first().click();
  await page.getByText("3件を候補に出しました。").waitFor();
  const myToken = await page.evaluate(() => localStorage.getItem("pxmeet:owner-token"));
  const myRef = await deriveRef(myToken);
  const poolView = await fetch(`${BASE}/api/meet/pool?me=${await deriveRef(TOK_A)}`, {
    headers: { Authorization: AUTH },
  }).then((r) => r.json());
  check(
    "added item reaches the served pool (regression #1)",
    poolView.items.some((i) => i.title === "週末の手伝い"),
  );
  check(
    "banner cleared after update",
    !(await page.getByText("候補の変更が", { exact: false }).isVisible().catch(() => false)),
  );

  // 5b. c12-3/4: 名前の往復 — the 探しに行く gate follows the CURRENT name,
  // and the checklist name row links to the 記憶 name field (#name)
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.locator("input.m-field").first().fill("");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.getByRole("button", { name: "保存しました" }).waitFor();
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  check(
    "cleared name hides 探しに行く (c12-3)",
    (await page.getByRole("button", { name: "探しに行く", exact: true }).count()) === 0,
  );
  await waitCheck("checklist name row returns", page.getByText("候補に出すときの名前がまだありません。"));
  await page.getByRole("link", { name: "記憶で書けます" }).click();
  await page.waitForURL(/#name$/);
  check("name row link lands on 記憶 #name (c12-4)", await page.locator("#name input.m-field").first().isVisible());
  await page.locator("input.m-field").first().fill("みどり");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.getByRole("button", { name: "保存しました" }).waitFor();
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  await waitCheck("re-named: 探しに行く returns (c12-3)", page.getByRole("button", { name: "探しに行く", exact: true }));

  // 6. signal from あや → talk back → mutual → contact note
  const sig = await api("/api/meet/signal", { ownerToken: TOK_A, toRef: myRef, fromName: "あや", anchor: "納屋 × 活版印刷" });
  check("seeded 話してみる from あや", sig.status === 201);
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  await waitCheck("section heading あなたへの「話してみる」", page.getByRole("heading", { name: "あなたへの「話してみる」" }));
  await waitCheck("incoming copy (押しました)", page.getByText("あやさんが「話してみる」を押しました。"));
  await shot("06-home-incoming");
  await page.getByRole("button", { name: "こちらも話してみる" }).click();
  await page.getByText("おたがいが「話してみる」を押しました。").waitFor();
  await page.getByPlaceholder("例：LINEのID、メール、電話など、つながれる窓口").fill("メール: midori@example.jp");
  await page.getByRole("button", { name: "渡す", exact: true }).click();
  await page.getByRole("button", { name: "渡しました" }).waitFor();
  check("contact note handed over", true);
  await shot("07-home-mutual-contact");
  const inboxA = await api("/api/meet/inbox", { ownerToken: TOK_A });
  check("あや receives みどり's note", inboxA.body?.notes?.some((n) => n.note === "メール: midori@example.jp"));

  // 7. receive attempt (fake key) — honest typed error, 第9便: as a DATED
  // ENTRY at the top of AIが見つけた提案
  await page.getByRole("button", { name: "探しに行く" }).click();
  // 視覚一新: proposal entries render as .m-entry cards now
  const errEntry = page.locator(".m-entry", { hasText: "探しに行きました" }).first();
  await errEntry.waitFor({ timeout: 30000 });
  const errText = await errEntry.locator(".m-item-text").first().innerText();
  check("receive shows an honest typed error ENTRY (fake key)", /ませんでした|もう一度/.test(errText));
  console.log("    receive error copy: " + errText.trim());
  await shot("08-home-receive-error");

  // 8. 進行役 — pool now visible (disclosed), logs + signals, key-gated
  await page.goto(`${BASE}/meet/host/`, { waitUntil: "networkidle" });
  await page.locator("input[type=password]").fill("host-local");
  await page.getByRole("button", { name: "開く" }).click();
  await waitCheck("host shows 候補プール", page.getByRole("heading", { name: "候補プール" }));
  await waitCheck("host shows 提案と読み", page.getByRole("heading", { name: "提案と読み" }));
  await waitCheck("host shows 「話してみる」のながれ", page.getByRole("heading", { name: "「話してみる」のながれ" }));
  await shot("09-host");
} finally {
  await browser.close();
}

const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "ALL UI SMOKE CHECKS PASSED" : `${failed.length} UI CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
