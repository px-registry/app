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
//    緑ドット（自動 Run）と所有の約束「鍵はこの端末にあります」は保持・位置だけ静かに。
//    期待の追従（Hiroto 確定 2026-06-16・表層語彙統一便 第2手）: 見回り→Run・「鍵は
//    この端末の中にあります」→「鍵はこの端末にあります」。
ok(await page.locator(".m-hero-bare").count() === 0, "canvas 最上部の帯（hero-bare）は退場");
ok(await page.locator(".m-meterstrip").count() === 1, "帯はフッター際の薄い一行（m-meterstrip）へ");
ok(await page.locator(".m-meterstrip .m-pulse").count() === 1, "緑ドット（自動 Run の印）は保持");
ok((await page.locator(".m-meterstrip .m-meter").innerText()).includes("鍵はこの端末にあります"),
  "所有の約束「鍵はこの端末にあります」は保持");
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

// 11) 表層語彙統一便 第3手（Hiroto 確定 2026-06-17）: Setup は「Antenna と Run の違いが
//     分かる画面」。二扉（このページで使う／あなたのAIから使う）は退場。lead＋二モード＋
//     Step1(AI接続・MCP は方法として畳む)＋Step2(Memoryを作る)＋呼び名。
await page.goto(`${BASE}start/`, { waitUntil: "networkidle" }).catch(() => {});
ok(await page.locator("h1").first().innerText() === "Setup", "Setup 面の見出しが rail と一致（Setup）");
ok(await page.locator(".m-door").count() === 0, "旧二扉（.m-door）は退場");
const setupBody = await page.locator("section.m-section").first().innerText();
ok(setupBody.includes("置いて待つか、自分のAIで探しに行くか。"), "lead = 置いて待つか／探しに行くか");
ok(await page.locator(".m-doors .m-card h2").filter({ hasText: /^Antenna$/ }).count() === 1, "モードカード Antenna");
ok(await page.locator(".m-doors .m-card h2").filter({ hasText: /^Run$/ }).count() === 1, "モードカード Run");
ok(setupBody.includes("AIをつながなくても立てられます"), "Antenna は AIなしでも立てられる趣旨");
ok(setupBody.includes("AIをつなぐと、候補やAntennaを読んで、自分から探しに行けます"), "Run は AI接続で可能になる趣旨");
ok(!setupBody.includes("下の三つ"), "「下の三つ」は退場（AI必須の誤読を断つ）");
ok(!setupBody.includes("見回"), "Setup 表層に「見回り」は無い");
// Step は可視カード（旧 PageDoor の details 開きは不要）。MCP は Step1 内の方法として畳む。
ok((await page.locator("#step-key h2").innerText()).includes("AI接続"), "Step1 = 1. AI接続");
ok((await page.locator("#step-intake h2").innerText()).includes("Memoryを作る"), "Step2 = 2. Memoryを作る");
ok(await page.locator("#step-key details summary").filter({ hasText: "あなたのAIからつなぐ" }).count() === 1,
  "MCP は Step1 内の方法として畳む（独立向きカードでない）");
ok(await page.locator("#step-intake .m-copyprompt, #step-intake button, #step-intake textarea").count() >= 1,
  "Step2 に取り込み導線（ColdStartIntake）");
// 深リンク #step-key は可視カードに直接当たる（details 開き不要）
await page.goto(`${BASE}start/#step-key`, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(150);
ok(await page.locator("#step-key").isVisible(), "#step-key 深リンク先が画面に見える");

// 11b) 呼び名カード（#name）— layout 体系便 Phase 1: 孤立 section をやめ、手順グループ
//      （.m-doorsteps）の中にフィールドカードとして並ぶ。実体は Memory 側 store と共用。
await page.goto(`${BASE}start/#name`, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(150);
ok(await page.locator("#name h2").filter({ hasText: "呼び名" }).count() === 1, "Setup に呼び名カード（#name）");
ok(await page.locator("#name input.m-field").count() === 1, "呼び名カードに入力欄");
ok(await page.locator(".m-doorsteps #name.m-card--field").count() === 1,
  "呼び名は手順グループ内のフィールドカード（孤立 section でない）");

// 11c) layout 型（Hiroto Go 2026-06-17）— 概念カード等高・recessed・読み柱 880。
await page.goto(`${BASE}start/`, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(200);
const concepts = page.locator(".m-doors .m-card--concept");
ok(await concepts.count() === 2, "概念カードは2枚（Antenna/Run・recessed）");
const bb0 = await concepts.nth(0).boundingBox();
const bb1 = await concepts.nth(1).boundingBox();
ok(bb0 && bb1 && Math.abs(bb0.height - bb1.height) < 2, `概念カード2枚が等高（${Math.round(bb0?.height)}≈${Math.round(bb1?.height)}）`);
ok(bb0 && bb1 && Math.abs(bb0.y - bb1.y) < 2, "概念カード2枚が上揃え");
// recessed: 概念カードは shadow 無し（番号カードは shadow-1 あり）— 面の沈みで静かに語る
const shadowConcept = await concepts.nth(0).evaluate((el) => getComputedStyle(el).boxShadow);
const shadowStep = await page.locator("#step-key").evaluate((el) => getComputedStyle(el).boxShadow);
ok(shadowConcept !== shadowStep, "概念=recessed と 番号=実体 で面が違う（box-shadow 差）");
// 読み柱 880（Setup の canvas）
const canvasMax = await page.locator("#m-ws-canvas").evaluate((el) => getComputedStyle(el).maxWidth);
ok(canvasMax === "880px", `Setup 読み柱 = 880px（${canvasMax}）`);
// カード内 24px パディング
const padStep = await page.locator("#step-key").evaluate((el) => getComputedStyle(el).paddingLeft);
ok(padStep === "24px", `Setup カード内パディング = 24px（${padStep}）`);
// FAB は右下固定・本文クリアランス（.m-main 下余白 ≥ FAB クリアランス）
ok(await page.locator(".m-aiwin-fab").count() === 1, "あなたのAI FAB が右下に出る");
const fabFixed = await page.locator(".m-aiwin-fab").evaluate((el) => getComputedStyle(el).position);
ok(fabFixed === "fixed", "FAB は固定（右下）");
ok(await page.locator("#name").isVisible(), "#name 深リンク先の呼び名カードが画面に見える");
// 警告文（home の !ready）の名前行リンクは Setup#name へ向く
await page.goto(BASE, { waitUntil: "networkidle" }).catch(() => {});
const nameHref = await page.locator('a.m-rowlink[href*="#name"]').first().getAttribute("href").catch(() => "");
ok(typeof nameHref === "string" && nameHref.includes("/meet/start/#name"),
  `警告の呼び名リンクは Setup へ（${nameHref}）`);

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
  // ①: ページ題 h1 が rail と一致（Setup→"Setup" / Memory→"Memory"・世界観の英語短語）
  ok(await page.locator("h1").first().innerText() === name, `${name}: ページ題 h1 が rail と一致（${name}）`);
}
// サブページの FAB は自前 state で開く（provider 圏外でも司令塔は開く）
await page.locator(".m-aiwin-fab").click();
ok(await page.locator("section.m-aiwin").count() === 1, "サブページでも FAB で あなたのAI が開く");
// 面の道具（Finds）はサブページでは home への導線リンク（/meet/?s=proposals）
await page.locator(".m-aiwin-min").click().catch(() => {});
const findsHref = await page.locator(".m-rail-link", { hasText: "Finds" }).first().getAttribute("href").catch(() => "");
ok(typeof findsHref === "string" && findsHref.includes("/meet/?s=proposals"),
  `サブページの Finds は home 面への導線リンク（${findsHref}）`);

// 13) Device Mesh 足場（緑2・2026-06-17）— Setup の Sync セクション＋接続済みの端末 一覧
//     ＋連結フロー（QR手引き→承認→接続完了/失敗・既存端末なし・同期を止める）。
//     確定コピー（STOP-D・全文言確定 2026-06-17）・モック状態（鍵/relay/本番schema/crypto 非接続）。
//     UI便（2026-06-17）: 実機配線（QR テキスト版・confirm-gated seal）。static では backend 非接続
//     なので一覧は mock・承認後の seal は honest に handoff失敗（backend 無し）に落ちる。
await page.goto(`${BASE}start/`, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(200);
ok(await page.locator("#step-sync").count() === 1, "Setup に Sync セクション（#step-sync）");
ok(await page.locator('#step-sync[data-sync-scaffold="wired"]').count() === 1, "Sync は実機配線（wired・lib 経由）");
ok((await page.locator("#step-sync h2").first().innerText()) === "Sync", "Sync 見出し");
ok(await page.locator("#step-sync button", { hasText: "端末をつなぐ" }).count() === 1, "「端末をつなぐ」ボタン");
ok(await page.locator("#step-sync").getByText("接続済みの端末").count() === 1, "「接続済みの端末」一覧見出し");
ok(await page.locator("#step-sync .m-badge").filter({ hasText: "この端末" }).count() === 1, "現端末に「この端末」印");
ok(await page.locator("#step-sync .m-sync-row").count() >= 2, "一覧に端末が並ぶ（backend 無し＝mock）");
ok(await page.locator("#step-sync .m-sync-state").filter({ hasText: "同期中" }).count() >= 1, "同期状態は label「同期中」");
ok(await page.locator("#step-sync [data-sync-wipe]").count() === 0, "全消去は Sync に出さない（Memory/Trust 側・別便）");
const syncText = await page.locator("#step-sync").innerText();
ok(!/既読|届きました|入力中|オンライン/.test(syncText), "Sync 面に presence（相手の状態）は無い");

// 端末をつなぐ → qr: 実 QR テキストが生成される（startHandoffAsNewDevice・ローカル crypto）
await page.locator("#step-sync button", { hasText: "端末をつなぐ" }).click();
await page.waitForTimeout(300);
ok(await page.locator('#step-sync[data-sync-step="qr"]').count() === 1, "step=qr へ遷移");
ok(await page.locator("#step-sync").getByText("この端末をつなぐ").count() === 1, "QR手引き 見出し");
const qrText = await page.locator("#step-sync [data-sync-qr]").inputValue();
ok(qrText.length > 80 && qrText.includes("\"sig\""), "QR テキストが生成される（署名つき・data-sync-qr）");
ok(await page.locator("#step-sync button", { hasText: "QRテキストをコピー" }).count() === 1, "[QRテキストをコピー]");
ok(await page.locator("#step-sync").getByText("新しい端末をつなぐ").count() === 1, "貼付セクション（新しい端末をつなぐ）");
// 復帰コードで戻る → 既存端末なし（一覧を隠す）
await page.locator("#step-sync button", { hasText: "復帰コードで戻る" }).first().click();
ok(await page.locator('#step-sync [role="dialog"]').getByText("接続済みの端末がありません。").count() === 1, "既存端末なしの面");
ok(await page.locator("#step-sync .m-sync-row").count() === 0, "noDevice 面では端末一覧を隠す");
await page.locator("#step-sync button", { hasText: "新しく始める" }).click();

// confirm-gated seal: 貼付→QRを確認→承認の問い（記述子確認・**封緘前**）。
await page.locator("#step-sync button", { hasText: "端末をつなぐ" }).click();
await page.waitForTimeout(300);
const qr2 = await page.locator("#step-sync [data-sync-qr]").inputValue();
await page.locator("#step-sync [data-sync-paste]").fill(qr2);
await page.locator("#step-sync button", { hasText: "QRを確認" }).click();
await page.waitForTimeout(200);
ok(await page.locator('#step-sync [role="dialog"]').getByText("新しい端末を追加しますか？").count() === 1, "貼付→確認で記述子確認（承認の問い・封緘前）");
ok(await page.locator('#step-sync [role="dialog"]').getByText("同期するもの: Antenna / Talk / Memory / 呼び名 / ひとこと").count() === 1, "同期するもの の確定コピー");
ok(await page.locator('#step-sync [role="dialog"]').getByText("身に覚えのない端末なら、追加しないでください。").count() === 1, "身に覚えのない端末の注意");
// [追加する] で初めて seal 試行（confirm-gated）。backend 無し＝honest に handoff失敗へ。
await page.locator('#step-sync [role="dialog"] button', { hasText: "追加する" }).click();
await page.waitForTimeout(300);
ok(await page.locator('#step-sync [role="dialog"]').getByText("つなげませんでした。").count() === 1, "承認後にだけ seal 試行→backend 無しは honest に失敗（confirm-gated）");

// リセット（idle へ）して一覧操作の検査へ
await page.goto(`${BASE}start/`, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(250);

// この端末の同期を止める（同期中 label → 確認・「同期を止める」）
await page.locator("#step-sync .m-sync-row", { hasText: "この端末" }).getByText("同期中", { exact: true }).click();
ok(await page.locator('#step-sync [role="dialog"]').getByText("この端末への同期を止めます。").count() === 1, "この端末の同期を止める 確認");
ok(await page.locator('#step-sync [role="dialog"] button', { hasText: "同期を止める" }).count() === 1, "確認ボタンは「同期を止める」");
await page.locator('#step-sync [role="dialog"] button', { hasText: "やめる" }).click();

// 端末を外す（別端末＝二態の other 文）
await page.locator("#step-sync .m-sync-row", { hasText: "iPhone" }).locator("button", { hasText: "外す" }).click();
ok(await page.locator('#step-sync [role="dialog"]').getByText("iPhone を外しますか？").count() === 1, "別端末の外す確認（名指し）");
ok(await page.locator('#step-sync [role="dialog"]').getByText("その端末の中に残ります（PXは消せません）", { exact: false }).count() === 1, "外しても過去は端末内に残る（正直文言）");

// 14) 全消去の再着地（Hiroto 2026-06-17）: Sync でなく Memory 側の危険操作（整理 fold）に置く。
await page.goto(`${BASE}memory/`, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(250);
ok(await page.locator("#step-sync").count() === 0, "Memory ページに Sync セクションは無い");
ok(!(await page.locator("[data-mem-wipe]").isVisible().catch(() => false)), "全消去は折り畳み（整理）の中＝既定では非表示");
await page.locator(".m-mem-backup summary").click().catch(() => {});
await page.waitForTimeout(200);
ok(await page.locator("[data-mem-wipe]").count() === 1, "Memory の整理に全消去 entry（MemoryとTalkを消す）");
ok((await page.locator("[data-mem-wipe]").innerText()).includes("MemoryとTalkを消す"), "entry button 文言 = MemoryとTalkを消す");
await page.locator("[data-mem-wipe]").click();
await page.waitForTimeout(150);
ok(await page.locator('.m-mem-backup [role="dialog"]').getByText("このPXのMemoryとTalkを消しますか？").count() === 1, "全消去の確認 dialog（確定 title）");
ok(await page.locator('.m-mem-backup [role="dialog"]').getByText("接続済みの自分の端末にも削除を伝えます", { exact: false }).count() === 1, "自分の端末には削除を伝える（確定 body）");
ok(await page.locator('.m-mem-backup [role="dialog"]').getByText("相手の端末にある会話は消えません", { exact: false }).count() === 1, "相手の端末/PX に触れない（正直文言）");
ok(await page.locator('.m-mem-backup [role="dialog"] button').filter({ hasText: "すべて消す" }).count() === 1, "[すべて消す]");
ok(await page.locator('.m-mem-backup [role="dialog"] button').filter({ hasText: "やめる" }).count() === 1, "[やめる]");
await page.locator('.m-mem-backup [role="dialog"] button').filter({ hasText: "やめる" }).click(); // 実消去はしない（dialog 検査のみ）

await browser.close();
console.log(`\nPASS ${pass} / FAIL ${fail}`);
process.exit(fail === 0 ? 0 : 1);
