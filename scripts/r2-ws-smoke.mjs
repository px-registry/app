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

// 1) 器が立つ: rail（toolbar）＋canvas（region）＋5道具
ok(await page.locator("nav.m-rail .m-rail-inner[role=toolbar]").count() === 1, "rail = role=toolbar");
ok(await page.locator(".m-rail-item").count() === 5, "rail に道具5つ");
ok(await page.locator("#m-ws-canvas[role=region]").count() === 1, "canvas = role=region");

// 2) 既定はアンテナ面（data-active＋aria-pressed）
ok(await page.locator('.m-rail-item[data-active="true"]').first().innerText() === "Antenna", "既定の面=アンテナ");
ok(await page.locator("#m-ws-canvas .m-composer").count() === 1, "canvas にアンテナの問い欄");

// 3) rail で提案面へ切替 → canvas が変わる（Dock 検索の見出し）
await page.getByRole("button", { name: "AIが見つけた提案" }).click();
ok(await page.locator("#m-ws-canvas").getByText("探してもらう").count() >= 1, "提案面: Dock 検索が canvas に開く");
ok(await page.locator("#m-ws-canvas .m-composer").count() === 0, "提案面: アンテナの問い欄は消える（一面）");

// 4) トーク面へ切替
await page.getByRole("button", { name: "あなたへの「話してみる」" }).click();
ok(await page.locator('.m-rail-item[data-active="true"]').first().innerText() === "あなたへの「話してみる」", "トーク面に切替");

// 5) あなたのAI 窓トグル（floating 窓が開く）
ok(await page.locator(".m-aiwin").count() === 0, "窓は既定で閉じ（FAB のみ）");
await page.getByRole("button", { name: "あなたのAI", exact: true }).first().click();
ok(await page.locator("section.m-aiwin").count() === 1, "rail の窓トグルで あなたのAI が開く");

// 6) キーボード: rail の最初の道具へフォーカス → ArrowDown で次へ（roving）
await page.locator(".m-rail-item").first().focus();
const before = await page.evaluate(() => document.activeElement?.textContent);
await page.keyboard.press("ArrowDown");
const after = await page.evaluate(() => document.activeElement?.textContent);
ok(before === "Antenna" && after !== before && after !== null, `ArrowDown で roving (${before} → ${after})`);
// Escape は窓側で扱う — rail では何も壊さない（フォーカスが rail 内に留まる）
ok(await page.evaluate(() => document.activeElement?.classList.contains("m-rail-item")), "roving 後もフォーカスは rail 内");

await browser.close();
console.log(`\nPASS ${pass} / FAIL ${fail}`);
process.exit(fail === 0 ? 0 : 1);
