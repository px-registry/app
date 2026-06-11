// R1.5 c17 smoke — この接点で話す: real qwen drafts the first note (wiring
// proof only — 品位は Hiroto の実鍵で目視). Prereqs: wrangler dev :8788,
// ollama serve, tables wiped + r15-smoke.ps1 seeded.
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
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await ctx.newPage();

try {
  // setup: name + local AI lane + memory substrate
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.locator("input.m-field").first().fill("みどり");
  await page.getByRole("button", { name: "保存", exact: true }).first().click();
  await page.getByText("保存しました").waitFor();
  await page.goto(`${BASE}/meet/start/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ローカルAI（Ollama）" }).click();
  await page.getByText("つかうモデル（この端末にあるもの）").waitFor({ timeout: 15000 });
  await page.locator("textarea:not([readonly])").last().fill(MEMORY_PASTE);
  await page.getByRole("button", { name: "取り込む" }).click();
  await page.getByRole("button", { name: "この2件で確定する" }).click();
  await page.getByText("記憶の下地ができました。").waitFor();
  // c18: signals to a peer OUTSIDE the pool are refused now — みどり must be
  // in the pool before あや's seed signal can land.
  await page.goto(`${BASE}/meet/memory/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "候補に出す", exact: true }).click();
  await page.getByText("2件を候補に出しました。").waitFor();

  // mutual pair: あや signals me, I talk back (応答側 — anchor is the material).
  // The owner token is MINTED on the first home visit — visit before reading it.
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  const myToken = await page.evaluate(() => localStorage.getItem("pxmeet:owner-token"));
  const myRef = await deriveRef(myToken);
  const sig = await api("/api/meet/signal", { ownerToken: TOK_A, toRef: myRef, fromName: "あや", anchor: "あなたの納屋 × ［あや］の活版印刷" });
  check("seeded 話してみる from あや", sig.status === 201);
  await page.goto(`${BASE}/meet/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "こちらも話してみる" }).click();
  await page.getByText("この接点で話す").waitFor({ timeout: 15000 });
  check("pair opens the face", true);

  // 生成 → textarea (real qwen; slow is fine — wiring is the question here)
  // PX-endpoint tripwire rides the whole generation too
  const apiBodies = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/meet/")) apiBodies.push(req.postData() ?? "");
  });
  await page.getByRole("button", { name: "最初の一言を作る" }).click();
  await page.waitForFunction(
    () => (document.querySelector(".m-talkface textarea")?.value ?? "").trim() !== "",
    undefined,
    { timeout: 240000 },
  );
  const draft = await page.locator(".m-talkface textarea").inputValue();
  console.log("    draft: " + draft.replace(/\n/g, " / "));
  check("qwen filled the draft", draft.trim() !== "");
  check("no error line", !(await page.getByText("下書きを作れませんでした", { exact: false }).isVisible().catch(() => false)));
  await page.screenshot({ path: `${SHOT_DIR}/r15n-01-first-note-drafted.png`, fullPage: true });

  // owner's words win: edit, copy, reload — the edit survives
  const edited = draft.trim() + "（自分の言葉に直した）";
  await page.locator(".m-talkface textarea").fill(edited);
  await page.locator(".m-talkface textarea").blur();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "コピー", exact: true }).click();
  await page.locator(".m-talkface").getByText("コピーしました").waitFor();
  // readText comes back CRLF-normalized on Windows for multi-line bodies —
  // compare with newlines folded (the write side sends the exact string)
  const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
  check("clipboard carries the edited words", clip === edited.replace(/\r\n/g, "\n"));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".m-talkface textarea").waitFor();
  await page.waitForFunction(
    () => (document.querySelector(".m-talkface textarea")?.value ?? "").includes("自分の言葉に直した"),
    undefined,
    { timeout: 10000 },
  );
  check("edited draft survives reload", true);
  check("tripwire: draft text on no PX request", apiBodies.every((b) => !b.includes("自分の言葉に直した") && !b.includes(draft.trim().slice(0, 24))));
  await page.screenshot({ path: `${SHOT_DIR}/r15n-02-first-note-reload.png`, fullPage: true });
} catch (e) {
  console.log("SMOKE ERROR: " + e.message.split("\n")[0]);
  await page.screenshot({ path: `${SHOT_DIR}/r15n-99-error.png`, fullPage: true }).catch(() => {});
  results.push(["(no exception)", false]);
}
await browser.close();

const failed = results.filter(([, ok]) => !ok);
console.log("");
console.log(failed.length === 0 ? "C17 SMOKE: ALL PASSED" : `${failed.length} CHECK(S) FAILED`);
process.exit(failed.length === 0 ? 0 : 1);
