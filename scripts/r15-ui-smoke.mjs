// R1.5 UI smoke — drives the real app in a mobile viewport against wrangler
// local D1, and saves screenshots. Scratch — not committed.
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
const shot = (name) => page.screenshot({ path: `${SHOT_DIR}/r15-${name}.png`, fullPage: true });

try {
  // 1. home — first visit (prerequisites listed honestly)
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  await waitCheck("home renders 今日の問い", page.getByRole("heading", { name: "今日の問い" }));
  await waitCheck("home lists missing steps", page.getByText("AIがまだつながっていません"));
  await shot("01-home-first-visit");

  // 2. はじめかた — key + cold-start intake
  await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
  await shot("02-start-top");
  await page.locator("input[type=password]").fill("sk-ant-local-smoke");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await waitCheck("key saved → つながっています", page.getByText("つながっています。"));

  await page.getByRole("button", { name: "プロンプトをコピー" }).click();
  await waitCheck("copy button flips to コピーしました", page.getByText("コピーしました"));
  await page.locator("textarea:not([readonly])").last().fill(SAMPLE);
  await page.getByRole("button", { name: "取り込む" }).click();
  await page.getByRole("button", { name: "この3件で確定する" }).waitFor();
  check("review shows 3 items", (await page.locator(".m-item").count()) === 3);
  check("private item shows 非公開", (await page.locator(".m-toggle:not(.m-toggle-on)").count()) === 1);
  await shot("03-intake-review");
  await page.getByRole("button", { name: "この3件で確定する" }).click();
  await waitCheck("intake done", page.getByText("記憶の下地ができました。"));

  // 3. memory — name, publish
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.locator(".m-itemlist .m-item").first().waitFor();
  check("memory lists 3 items", (await page.locator(".m-itemlist .m-item").count()) === 3);
  await page.locator("input.m-field").first().fill("みどり");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: "公開する", exact: true }).waitFor();
  await page.getByRole("button", { name: "公開する", exact: true }).click();
  await page.getByText("2件を出しました。").waitFor();
  check("publish 2 public items", true);
  await shot("04-memory-published");

  // 4. pool — sees A(あや) and B(カフェの人), never own items
  await page.goto(`${BASE}/meet/pool/`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "あや" }).waitFor();
  check("pool shows あや", true);
  await waitCheck("pool shows カフェの人", page.getByRole("heading", { name: "カフェの人" }));
  check("pool hides own items", (await page.getByText("古い町家の納屋").count()) === 0);
  await shot("05-pool");

  // 5. signal A -> browser owner; talk back to mutual; contact note exchange
  const myToken = await page.evaluate(() => localStorage.getItem("pxmeet:owner-token"));
  check("owner token minted", typeof myToken === "string" && myToken.length >= 32);
  const myRef = await deriveRef(myToken);
  const sig = await api("/api/meet/signal", { ownerToken: TOK_A, toRef: myRef, fromName: "あや", anchor: "納屋 × 活版印刷" });
  check("seeded signal from あや", sig.status === 201);

  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  await page.getByText("あや から「話してみる」の合図").waitFor();
  await shot("06-home-incoming-signal");
  await page.getByRole("button", { name: "こちらも話してみる" }).click();
  await page.getByText("おたがいに合図が出ています。").waitFor();
  check("mutual state shown", true);
  await page.getByPlaceholder("例：LINEのID、メール、電話など、つながれる窓口").fill("メール: midori@example.jp");
  await page.getByRole("button", { name: "渡す", exact: true }).click();
  await page.getByRole("button", { name: "渡しました" }).waitFor();
  check("contact note handed over", true);
  await shot("07-home-mutual-contact");

  // A's inbox should now carry みどり's note (server-side mutual join)
  const inboxA = await api("/api/meet/inbox", { ownerToken: TOK_A });
  check(
    "あや receives みどり's note",
    inboxA.body?.notes?.some((n) => n.note === "メール: midori@example.jp"),
  );

  // 6. receive attempt with a fake key — honest typed error, loop not broken
  await page.getByRole("button", { name: "提案を受け取る" }).click();
  await page.locator("p.m-note[aria-live=polite]").waitFor({ timeout: 30000 });
  const errText = await page.locator("p.m-note[aria-live=polite]").innerText();
  check("receive shows an honest typed error (fake key)", errText.trim().length > 0);
  console.log("    receive error copy: " + errText.trim());
  await shot("08-home-receive-error");

  // 7. 進行役 — key-gated host view
  await page.goto(`${BASE}/meet/host/`, { waitUntil: "networkidle" });
  await page.locator("input[type=password]").fill("wrong-key");
  await page.getByRole("button", { name: "開く" }).click();
  await page.getByText("開けませんでした").waitFor();
  check("host rejects wrong key", true);
  await page.locator("input[type=password]").fill("host-local");
  await page.getByRole("button", { name: "開く" }).click();
  await page.getByRole("heading", { name: "提案と読み" }).waitFor();
  check("host shows 提案と読み", true);
  await waitCheck("host shows signal flow", page.getByRole("heading", { name: "合図のながれ" }));
  await shot("09-host");
} finally {
  await browser.close();
}

const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "ALL UI SMOKE CHECKS PASSED" : `${failed.length} UI CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
