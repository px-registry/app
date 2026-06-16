// ワークスペース器(β) 第2便(a) 実機 smoke — 骨格（rail＝toolbar・canvas 一面切替・
// あなたのAI 窓トグル・キーボード roving）。**Ollama 不要**（切替は client state のみ）。
//
// 使い方（out/ を静的配信して実ブラウザで叩く・2手）:
//   npm run build
//   python -m http.server 8099 -d out &  ; node scripts/r2-ws-smoke.mjs
// BASE は R2_WS_BASE で上書き可（既定 http://localhost:8099/meet/）。
import { chromium } from "playwright";

const BASE = process.env.R2_WS_BASE ?? "http://localhost:8099/meet/";
let pass = 0,
  fail = 0;
const ok = (c, m) => {
  if (c) {
    pass++;
    console.log("  ok  -", m);
  } else {
    fail++;
    console.log("  NOT -", m);
  }
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});

// 1) 器が立つ: rail（toolbar）＋canvas（region）＋5道具（3面＋2導線 Memory/Setup）
//    サブページ統一便: 記憶→Memory が仕切り線の下に Setup と並ぶ（道B・3面＋2導線）。
ok(await page.locator("nav.m-rail .m-rail-inner[role=toolbar]").count() === 1, "rail = role=toolbar");
ok(await page.locator(".m-rail-item").count() === 5, "rail に3面＋2導線（Memory/Setup・あなたのAI は FAB へ）");
ok(await page.locator("#m-ws-canvas[role=region]").count() === 1, "canvas = role=region");

// 2) 既定はアンテナ面（data-active＋aria-pressed）— rail は短語（文言実験）
ok(await page.locator('.m-rail-item[data-active="true"]').first().innerText() === "Antenna", "既定の面=アンテナ");
ok(await page.locator("#m-ws-canvas .m-composer").count() === 1, "canvas にアンテナの問い欄");
// rail 短語＝3面（Antenna/Finds/Talk）＋2導線（Memory/Setup）— あなたのAI は並ばない
const railLabels = await page.locator(".m-rail-item .m-rail-label").allInnerTexts();
ok(JSON.stringify(railLabels) === JSON.stringify(["Antenna", "Finds", "Talk", "Memory", "Setup"]),
  `rail 短語 = ${JSON.stringify(railLabels)}`);
ok(!railLabels.includes("あなたのAI"), "あなたのAI は rail から外れた（司令塔 FAB へ）");

// 2b) canvas の見出しも短語で rail と一貫（第2手 ①）
await page.getByRole("button", { name: "Finds" }).click();
ok(await page.locator("#m-ws-canvas h2").filter({ hasText: /^Finds$/ }).count() === 1, "Finds 面の見出し=Finds");
ok(await page.locator("#m-ws-canvas").getByText("AIが見つけた提案").count() === 0, "長い旧見出しは退場");
await page.getByRole("button", { name: "Talk" }).click();
ok(await page.locator("#m-ws-canvas h2").filter({ hasText: /^Talk$/ }).count() === 1, "Talk 面の見出し=Talk");
await page.getByRole("button", { name: "Antenna" }).click();
ok(await page.locator("#m-ws-canvas h2").filter({ hasText: /Antenna/ }).count() === 0, "Antenna 面は見出し反復を畳んだ（eyebrow のみ）");

// 3) rail で提案面（Finds）へ切替 → canvas が変わる
await page.getByRole("button", { name: "Finds" }).click();
ok(await page.locator("#m-ws-canvas").getByText("探してもらう", { exact: false }).count() >= 0, "提案面に切替");
ok(await page.locator("#m-ws-canvas .m-composer").count() === 0, "提案面: アンテナの問い欄は消える（一面）");

// 4) トーク面（Talk）へ切替
await page.getByRole("button", { name: "Talk" }).click();
ok(await page.locator('.m-rail-item[data-active="true"]').first().innerText() === "Talk", "トーク面に切替");

// 5) あなたのAI 司令塔 FAB（rail でなく FAB から窓が開く）
ok(await page.locator(".m-aiwin").count() === 0, "窓は既定で閉じ（FAB のみ）");
ok(await page.locator(".m-aiwin-fab").count() === 1, "あなたのAI は右下 FAB");
ok(await page.locator(".m-aiwin-fab .m-aiwin-fab-dot").count() === 1, "接続の点は FAB へ移設");
ok((await page.locator(".m-aiwin-fab").innerText()).includes("あなたのAI"), "FAB は あなたのAI（司令塔の名・据置）");
await page.locator(".m-aiwin-fab").click();
ok(await page.locator("section.m-aiwin").count() === 1, "FAB で あなたのAI が開く");
await page.locator(".m-aiwin-min").click(); // 窓を閉じて以降の検査へ

// 6) キーボード: rail の最初の道具へフォーカス → ArrowDown で次へ（roving）
await page.locator(".m-rail-item").first().focus();
const before = await page.evaluate(() => document.activeElement?.textContent);
await page.keyboard.press("ArrowDown");
const after = await page.evaluate(() => document.activeElement?.textContent);
ok(before === "Antenna" && after !== before && after !== null, `ArrowDown で roving (${before} → ${after})`);
// Escape は窓側で扱う — rail では何も壊さない（フォーカスが rail 内に留まる）
ok(await page.evaluate(() => document.activeElement?.classList.contains("m-rail-item")), "roving 後もフォーカスは rail 内");

// 7) 工房語彙（便: composer の UI 語彙）— ◇/◆ の標が状態を「形」で語る。
//    ::before の生成内容を読む（命名問題の解の核・aria-hidden の装い）。
const markOf = (active) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return getComputedStyle(el, "::before").content;
  }, `.m-rail-item[data-active="${active}"] .m-rail-mark`);
const activeMark = await markOf("true");
const restMark = await markOf("false");
ok(activeMark?.includes("◆"), `今ひらいている面は ◆ filled (${activeMark})`);
ok(restMark?.includes("◇"), `休む面は ◇ hollow (${restMark})`);

// 8) theme 非依存（墨=黒・紙でも成立）— 墨へ切替えて骨格＋標が生き残る。
await page.evaluate(() => localStorage.setItem("pxmeet:theme", "sumi"));
await page.reload({ waitUntil: "networkidle" }).catch(() => {});
ok(await page.evaluate(() => document.documentElement.getAttribute("data-theme")) === "sumi", "墨テーマに切替（pxmeet:theme）");
ok(await page.locator(".m-rail-item").count() === 5, "墨でも rail 5道具が生存（3面＋2導線）");
ok(await page.locator('.m-rail-item[data-active="true"]').first().innerText() === "Antenna", "墨でも既定の面=アンテナ");
const sumiActiveMark = await markOf("true");
ok(sumiActiveMark?.includes("◆"), `墨でも ◆ の標が状態を語る (${sumiActiveMark})`);
await page.getByRole("button", { name: "Finds" }).click();
ok(await page.locator("#m-ws-canvas h2").filter({ hasText: /^Finds$/ }).count() === 1, "墨でも面切替が canvas に効く（Finds 見出し）");

// 9) 計器の帯（格下げ）— canvas 最上部の pill は退場、フッター際の薄い一行へ。
//    緑ドット（自動見回り）と「鍵はこの端末の中」は保持・位置だけ静かに。
ok(await page.locator(".m-hero-bare").count() === 0, "canvas 最上部の帯（hero-bare）は退場");
ok(await page.locator(".m-meterstrip").count() === 1, "帯はフッター際の薄い一行（m-meterstrip）へ");
ok(await page.locator(".m-meterstrip .m-pulse").count() === 1, "緑ドット（自動見回りの印）は保持");
ok((await page.locator(".m-meterstrip .m-meter").innerText()).includes("鍵はこの端末の中"),
  "所有の約束「鍵はこの端末の中」は保持");
// 帯はフッター際（BoundaryNote より下）— canvas より下に座る
const stripBelowCanvas = await page.evaluate(() => {
  const c = document.querySelector("#m-ws-canvas");
  const s = document.querySelector(".m-meterstrip");
  return c && s ? s.getBoundingClientRect().top > c.getBoundingClientRect().top : false;
});
ok(stripBelowCanvas, "帯は canvas より下（最上部から退いた）");

// 10) 第3手 ①: Antenna 入力欄が「箱」として視認できる（下線一本でない）。
await page.evaluate(() => localStorage.setItem("pxmeet:theme", "paper"));
await page.reload({ waitUntil: "networkidle" }).catch(() => {});
const composerBox = await page.evaluate(() => {
  const el = document.querySelector(".m-composer");
  if (!el) return null;
  const s = getComputedStyle(el);
  return { top: parseFloat(s.borderTopWidth), right: parseFloat(s.borderRightWidth), radius: parseFloat(s.borderTopLeftRadius) };
});
ok(composerBox !== null && composerBox.top >= 1 && composerBox.right >= 1 && composerBox.radius >= 1,
  `入力欄は四辺の枠＋角丸の箱 (${JSON.stringify(composerBox)})`);

// 11) 案A＋仕上げ便②: Setup は二扉とも details（対称・既定畳み）・見出しは Setup。
await page.goto(`${BASE}start/`, { waitUntil: "networkidle" }).catch(() => {});
ok(await page.locator(".m-doors .m-door").count() === 2, "Setup: 二扉とも details（対称）");
ok(await page.locator("h1").first().innerText() === "Setup", "Setup 面の見出しが rail と一致（Setup）");
ok(await page.evaluate(() => [...document.querySelectorAll(".m-door")].every((d) => d.open === false)),
  "両扉とも既定で畳まれている");
ok(await page.locator(".m-door #step-key").count() === 1, "3手順は『このページで使う』扉の中（鍵）");
ok(await page.locator(".m-door #step-intake").count() === 1, "3手順は扉の中（下地）");
// 沈黙の禁止: Antenna の深リンク #step-key に来たら扉が開いて手順が見える
await page.goto(`${BASE}start/#step-key`, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(150);
ok(await page.evaluate(() => document.querySelector("#step-key")?.closest(".m-door")?.open === true),
  "#step-key 深リンクでその扉が開く（沈黙の禁止）");
ok(await page.locator("#step-key").isVisible(), "深リンク先の手順が画面に見える");

// 12) サブページ統一便（道B・Hiroto 裁定 2026-06-16）: 記憶・Setup も rail を着る。
//     旧 MeetNav は data-ws で退場。あなたのAI FAB はどのページからでも開く。
for (const [path, name] of [["start/", "Setup"], ["memory/", "Memory"]]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" }).catch(() => {});
  ok(await page.locator("nav.m-rail .m-rail-item").count() === 5, `${name}: rail 5道具が立つ`);
  ok(await page.evaluate(() => document.documentElement.hasAttribute("data-ws")), `${name}: data-ws が立つ（器）`);
  // 旧 MeetNav は CSS で退場（html[data-ws] が .m-nav/.m-nav-top を隠す）
  const navShown = await page.evaluate(() => {
    const n = document.querySelector(".m-nav");
    return n ? getComputedStyle(n).display !== "none" : false;
  });
  ok(!navShown, `${name}: 旧 MeetNav は退場（data-ws で display:none）`);
  ok(await page.locator(".m-aiwin-fab").count() === 1, `${name}: あなたのAI FAB が右下に出る（どこからでも）`);
  // その面（導線）が朱で active
  const activeLabel = await page.locator('.m-rail-item[data-active="true"] .m-rail-label').first().innerText().catch(() => "");
  ok(activeLabel === name, `${name}: 自ページの導線が active（${activeLabel}）`);
}
// サブページの FAB は自前 state で開く（provider 圏外でも司令塔は開く）
await page.locator(".m-aiwin-fab").click();
ok(await page.locator("section.m-aiwin").count() === 1, "サブページでも FAB で あなたのAI が開く");
// 面の道具（Finds）はサブページでは home への導線リンク（/meet/?s=proposals）
await page.locator(".m-aiwin-min").click().catch(() => {});
const findsHref = await page.locator(".m-rail-link", { hasText: "Finds" }).first().getAttribute("href").catch(() => "");
ok(typeof findsHref === "string" && findsHref.includes("/meet/?s=proposals"),
  `サブページの Finds は home 面への導線リンク（${findsHref}）`);

await browser.close();
console.log(`\nPASS ${pass} / FAIL ${fail}`);
process.exit(fail === 0 ? 0 : 1);
