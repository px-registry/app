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

  // 6. signal from あや → talk back → mutual → c17 この接点で話す → contact note
  const sig = await api("/api/meet/signal", { ownerToken: TOK_A, toRef: myRef, fromName: "あや", anchor: "納屋 × 活版印刷" });
  check("seeded 話してみる from あや", sig.status === 201);
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  await waitCheck("section heading あなたへの「話してみる」", page.getByRole("heading", { name: "あなたへの「話してみる」" }));
  await waitCheck("incoming copy (押しました)", page.getByText("あやさんが「話してみる」を押しました。"));
  check("c17: no face before mutual", (await page.locator(".m-talkface").count()) === 0);
  await shot("06-home-incoming");
  // c17 tripwire: from here on, NOTHING typed into the first-note textarea may
  // ride a PX request body (the draft is device-only; sending is copy→outside).
  const MARKER = "tripwire-第一信-c17";
  const apiBodies = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/")) apiBodies.push(req.postData() ?? "");
  });
  await page.getByRole("button", { name: "こちらも話してみる" }).click();
  await waitCheck("c17: pair opens the この接点で話す face", page.getByText("この接点で話す"));
  check("c17: 接点の再掲 (anchor) inside the face", await page.locator(".m-talkface .m-pairline", { hasText: "納屋 × 活版印刷" }).isVisible());
  check("c17: assist line", await page.getByText("AIが下書きします。送るのはあなたです。").isVisible());
  // fail-close: the saved key is fake → honest one-liner + the button stays (再試行可)
  await page.getByRole("button", { name: "最初の一言を作る" }).click();
  await waitCheck("c17: generation failure says so honestly", page.getByText("下書きを作れませんでした。もう一度試すか、自分の言葉でどうぞ。"));
  check("c17: retry stays available", await page.getByRole("button", { name: "最初の一言を作る" }).isEnabled());
  // L0: the textarea is hand-writable without AI; blur saves; reload keeps it
  await page.locator(".m-talkface textarea").fill(MARKER + " 自分の言葉で書く");
  await page.locator(".m-talkface textarea").blur();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".m-talkface textarea").waitFor();
  await page.waitForFunction(
    (m) => document.querySelector(".m-talkface textarea")?.value.includes(m),
    MARKER,
    { timeout: 10000 },
  );
  check("c17: draft survives reload (owner-local lane)", true);
  // コピー → コピーしました (clipboard granted in this context)
  await page.getByRole("button", { name: "コピー", exact: true }).click();
  await waitCheck("c17: copy flips to コピーしました", page.locator(".m-talkface").getByText("コピーしました"));
  check("c17: clipboard carries the draft", (await page.evaluate(() => navigator.clipboard.readText())).includes(MARKER));
  await shot("07a-home-first-note");
  // 従属位置の連絡メモ — fold to open, contents unchanged
  await page.locator(".m-contactfold summary", { hasText: "連絡メモを開く" }).click();
  await page.getByText("おたがいが「話してみる」を押しました。").waitFor();
  await page.getByPlaceholder("例：LINEのID、メール、電話など、つながれる窓口").fill("メール: midori@example.jp");
  await page.getByRole("button", { name: "渡す", exact: true }).click();
  await page.getByRole("button", { name: "渡しました" }).waitFor();
  check("contact note handed over", true);
  await shot("07-home-mutual-contact");
  const inboxA = await api("/api/meet/inbox", { ownerToken: TOK_A });
  check("あや receives みどり's note", inboxA.body?.notes?.some((n) => n.note === "メール: midori@example.jp"));
  // the tripwire verdict: the contact note went to /api (intended); the draft never did
  check("c17 tripwire: draft text never reaches a PX endpoint", apiBodies.every((b) => !b.includes(MARKER)));
  check("…while the contact lane did fire (monitor is live)", apiBodies.some((b) => b.includes("midori@example.jp")));

  // 6b. c18 — 死んだ edge への行為は正直に止まる（成功の顔をさせない）
  const TOK_B = "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2";
  const sigB = await api("/api/meet/signal", { ownerToken: TOK_B, toRef: myRef, fromName: "カフェの人", anchor: "" });
  check("c18: seeded second signal from カフェの人 (in pool)", sigB.status === 201);
  // 呼び名空: clear the name, press こちらも話してみる → 誘導一行（旧: 無言）
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.locator("input.m-field").first().fill("");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.getByRole("button", { name: "保存しました" }).waitFor();
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  const cafeCard = page.locator(".m-signal", { hasText: "カフェの人" });
  await cafeCard.getByRole("button", { name: "こちらも話してみる" }).click();
  await waitCheck("c18: 呼び名空 → 誘導一行", cafeCard.getByText("先に呼び名を決めてください。"));
  check("c18: 誘導一行は記憶#nameへのリンクを持つ", await cafeCard.getByRole("link", { name: "記憶で書けます" }).isVisible());
  check("c18: 呼び名空では mutual にならない", (await cafeCard.locator(".m-talkface").count()) === 0);
  await shot("07b-c18-name-required");
  // restore the name, then withdraw カフェの人 from the pool → notInPool line
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.locator("input.m-field").first().fill("みどり");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.getByRole("button", { name: "保存しました" }).waitFor();
  const unpub = await api("/api/meet/publish", { ownerToken: TOK_B, displayName: "カフェの人", items: [] });
  check("c18: カフェの人 withdrew from the pool", unpub.body?.ok === true);
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  await cafeCard.getByRole("button", { name: "こちらも話してみる" }).click();
  await waitCheck("c18: 取り下げ済み相手 → 正直な一行", cafeCard.getByText("この相手は、いまは候補に出ていません。"));
  check("c18: sent/mutual に化けない", (await cafeCard.locator(".m-talkface").count()) === 0 && (await cafeCard.getByRole("button", { name: "こちらも話してみる" }).isVisible()));
  check("c18: 他カード（あや mutual の c17 面）無変化", (await page.locator(".m-signal", { hasText: "あや" }).locator(".m-talkface").count()) === 1);
  await shot("07c-c18-not-in-pool");

  // 6c. c18b — 押す前から正直に（受動マーキング）・一手で片づく
  const refB = await deriveRef(TOK_B);
  // 提案側 fixture: カフェの人宛てカードを受信棚へ注入（生成なしの決定論）
  await page.evaluate(async ({ refB }) => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open("px-meet", 2);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("received", "readwrite");
        tx.objectStore("received").put({
          entryId: "recv_c18b_fixture",
          createdAt: new Date().toISOString(),
          question: "",
          modelLabel: "fixture",
          raw: "[]",
          cards: [{ to: "カフェの人", line1: "夜の店を一緒に試す相手です。", line2: "", line3: "", basisItemId: "p1" }],
          refs: { "カフェの人": refB },
          basisItems: { p1: { ownerRef: "カフェの人", title: "昼だけのカフェ", text: "平日昼に間借りで開けている" } },
          echoFlag: false,
          readings: {},
        });
        tx.oncomplete = () => { db.close(); resolve(undefined); };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }, { refB });
  await page.reload({ waitUntil: "networkidle" });
  // 合図カード: 押す前から不在一行＋静かなボタン＋片づける
  await waitCheck("c18b: 合図カードが押す前から不在一行", cafeCard.getByText("この相手は、いまは候補に出ていません。"));
  check("c18b: 行為ボタンは静かな見た目 (m-btn-dim)", (await cafeCard.locator("button.m-btn-dim").count()) === 1);
  check("c18b: 片づける は不在カードにだけ出る", (await cafeCard.getByRole("button", { name: "片づける" }).count()) === 1 && (await page.locator(".m-signal", { hasText: "あや" }).getByRole("button", { name: "片づける" }).count()) === 0);
  // 提案カード: 同じ一行＋静かなボタン（既存「この回を消す」が箒・新設なし）
  const fixtureEntry = page.locator(".m-entry", { hasText: "夜の店を一緒に試す相手です。" });
  await waitCheck("c18b: 提案カードも押す前から不在一行", fixtureEntry.getByText("この相手は、いまは候補に出ていません。"));
  check("c18b: 提案側の話してみるも静か", (await fixtureEntry.locator("button.m-btn-dim").count()) === 1);
  check("c18b: 提案側の箒は既存「この回を消す」", (await fixtureEntry.getByRole("button", { name: "この回を消す" }).count()) === 1);
  await shot("07d-c18b-marked");
  // 片づける → 消える → reload 後も非表示 → サーバ行は残存
  await cafeCard.getByRole("button", { name: "片づける" }).click();
  await page.locator(".m-signal", { hasText: "カフェの人" }).waitFor({ state: "detached" });
  check("c18b: 片づける → カードが消える", (await page.locator(".m-signal", { hasText: "カフェの人" }).count()) === 0);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".m-signal", { hasText: "あや" }).waitFor();
  check("c18b: reload 後も非表示が持続", (await page.locator(".m-signal", { hasText: "カフェの人" }).count()) === 0);
  check("c18b: あや（生きている mutual）は出続ける", (await page.locator(".m-signal", { hasText: "あや" }).count()) === 1);
  const inboxMine = await api("/api/meet/inbox", { ownerToken: myToken });
  check("c18b: サーバ行は残存（履歴不触）", inboxMine.body?.incoming?.some((s) => s.fromRef === refB) === true);
  await shot("07e-c18b-swept");

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
  // 9. c15: 忘却は owner の行為 — 一枚消す→整合の注意行、すべて消す→二段確認→空
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  const cardsBefore = await page.locator(".m-itemlist .m-item").count();
  // delete the PUBLISHED extra item (週末の手伝い) — pool copy stays → notice
  await page
    .locator(".m-item", { hasText: "週末の手伝い" })
    .getByRole("button", { name: "消す", exact: true })
    .click();
  await waitCheck(
    "c15-3: 出した項目を消すと注意行（沈黙の禁止）",
    page.getByText("候補に出した項目が含まれていました。", { exact: false }),
  );
  await waitCheck("c15-3: 未反映バナーも立つ", page.getByText("候補の変更が", { exact: false }));
  await page.reload({ waitUntil: "networkidle" });
  check(
    "c15-1: 一枚消す → reload 後も消えている",
    (await page.locator(".m-itemlist .m-item").count()) === cardsBefore - 1,
  );
  // すべて消す: 二段確認 → やめる → 残る → 消す → 空 → reload 後も空・名前は残る
  await page.locator(".m-promise summary", { hasText: "整理" }).click();
  await page.getByRole("button", { name: "すべて消す", exact: true }).click();
  await waitCheck(
    "c15-2: 二段確認が件数を言う",
    page.getByText(/\d+件の記憶をすべて消します。元に戻せません。/),
  );
  await page.getByRole("button", { name: "やめる", exact: true }).click();
  check("c15-2: やめる → 何も消えない", (await page.locator(".m-itemlist .m-item").count()) === cardsBefore - 1);
  await page.getByRole("button", { name: "すべて消す", exact: true }).click();
  await page.getByRole("button", { name: "消す", exact: true }).last().click();
  await waitCheck("c15-2: 全消去 → まだ記憶がありません", page.getByText("まだ記憶がありません", { exact: false }));
  await page.reload({ waitUntil: "networkidle" });
  check("c15-2: reload 後も空", (await page.locator(".m-itemlist .m-item").count()) === 0);
  check(
    "c15-2: 名前は残る（消すのは記憶カードのみ）",
    (await page.locator("input.m-field").first().inputValue()) === "みどり",
  );
  await shot("10-memory-cleared");
} finally {
  await browser.close();
}

const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "ALL UI SMOKE CHECKS PASSED" : `${failed.length} UI CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
