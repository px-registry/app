#!/usr/bin/env node
// px-guard — PreToolUse hook（起草版・Hiroto 一瞥まで未設置）。
//
// 原則: fail-closed 可視 — 遮断は黙らない。何を・なぜ止めたかを stderr に一行
// （沈黙の禁止の hook 版）。判定できない入力は通す（このフックは「最後の網」では
// なく「うっかりの網」— 深い守りは gate テストと境界設計が担う）。
//
// override（誤検知時・owner=Hiroto の行為）:
//   $env:PX_GUARD_OVERRIDE = "<ruleId>"  を設定して同じ操作をもう一度。
//   消費されたことを一行で表示する（黙って素通りしない）。使用後は env を消すこと。
//
// 終了コード: 0 = 通す / 2 = 遮断（stderr が Claude に返る）。

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const RULES_DOC = "docs/r2/hook-guard-proposal.md";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // 入力が読めない＝判定不能 → 通す（遮断理由を言えない遮断はしない）
}

const tool = input.tool_name ?? "";
const ti = input.tool_input ?? {};
const command = typeof ti.command === "string" ? ti.command : "";
const editedText = [ti.content, ti.new_string].filter((s) => typeof s === "string").join("\n");
const filePath = typeof ti.file_path === "string" ? ti.file_path : "";
const everything = JSON.stringify(ti);

function block(ruleId, what, why) {
  const ov = process.env.PX_GUARD_OVERRIDE ?? "";
  if (ov === ruleId) {
    process.stderr.write(`px-guard: override 消費 [${ruleId}] — Hiroto の明示解除で通します。env を消してください。\n`);
    process.exit(0);
  }
  process.stderr.write(`px-guard 遮断 [${ruleId}]: ${what} — ${why}（解除手順は ${RULES_DOC}）\n`);
  process.exit(2);
}

const isShell = tool === "Bash" || tool === "PowerShell";
const isEdit = tool === "Edit" || tool === "Write" || tool === "NotebookEdit";

// ── R1: git push（px-app は Hiroto 裁可制・px-table の branch push は通常運用）──
if (isShell && /\bgit\b[^\n;|&]*\bpush\b/.test(command) && !command.includes("px-table")) {
  block("push", "git push", "px-app の origin push は Hiroto 裁可制（恒久線）");
}

// ── R2: 保護ブランチへの直コミット ──────────────────────────────────────────────
if (isShell && /\bgit\b[^\n;|&]*\bcommit\b/.test(command)) {
  try {
    const m = command.match(/-C\s+("?)([^\s"]+)\1/);
    const branch = execSync(`git ${m ? `-C "${m[2]}"` : ""} branch --show-current`, {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    if (branch === "main" || branch === "master") {
      block("main-commit", `${branch} への直コミット`, "保護ブランチは branch→PR で積む");
    }
  } catch {
    /* branch 不明 → 通す（判定不能の遮断はしない） */
  }
}

// ── R3: .sort( の忍び込み（順位付けの種）────────────────────────────────────────
// owner-local の並べ替え・時刻順は明示許可箇所のみ。allowlist は path 前方一致。
const SORT_ALLOW = [
  "lib/meet-memory/received.ts", // 到着時刻順（時間であって品質でない・既存）
  "scripts/",                    // smoke/検査スクリプト
  "functions/api/meet/pool.ts",  // ORDER BY 到着順（SQL 側・既存）
];
if (isEdit && editedText.includes(".sort(")) {
  const rel = filePath.replace(/\\/g, "/").replace(/^.*?(px-app|px-table)\//, "");
  if (!SORT_ALLOW.some((p) => rel.startsWith(p))) {
    block(
      "sort",
      `.sort( を含む編集（${rel || "対象不明"}）`,
      "順位付けの忍び込み防止 — 必要なら一旦止めて申告（許可箇所は allowlist）",
    );
  }
}

// ── R4: API key らしき文字列の混入（commit・編集・送信のどれでも）────────────────
const KEY_RE = /(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{30,})/;
if ((isEdit || isShell) && KEY_RE.test(everything)) {
  block("key", "鍵らしき文字列を含む入力", "鍵は端末の中だけ — commit・チャット・送信のどこにも置かない");
}

// ── R5: 本番 D1 への --remote（px-app-board ぴったり・-r2dev は除外）─────────────
if (isShell && /--remote/.test(command) && /px-app-board(?!-r2dev)/.test(command)) {
  block("prod-d1", "px-app-board への --remote 操作", "本番 D1 はカットオーバーゲートまで不触（freeze）");
}

// ── R6: 本番 Pages project への deploy ──────────────────────────────────────────
if (isShell && /pages\s+deploy/.test(command) && /--project-name[= ]+"?(px-r15|px-app)\b/.test(command)) {
  block("prod-deploy", "本番 project への pages deploy", "本番接触は Hiroto Go（px-r2-dev だけが建設現場）");
}

// ── R7: private 流出形 payload（c17 tripwire の常時化・粗い網であることは仕様）──
// クォートのエスケープ形（\"private\" 等）も拾う — shell を経由する payload は
// 大抵エスケープされて流れる（便4 起草時の実測で素通りした穴を塞いだ形）。
if (isShell && command.includes("/api/meet/") && /private["'\\]*\s*:/.test(command)) {
  block("private-shape", "private キーを含む /api/meet/ への送信形", "private 本文は PX request body に乗らない（境界）");
}

// ── R8: 平文 contact 書込経路の復活（E2EE 移行後に有効化・現在は休眠）────────────
const R8_ARMED = existsSync(new URL("./px-guard.r8-armed", import.meta.url));
if (R8_ARMED && isEdit && /INSERT\s+INTO\s+r15_contact_note/i.test(editedText)) {
  block("plain-contact", "平文 contact_note への書込コードの追加", "E2EE 移行後の平文経路復活は境界違反");
}

process.exit(0);
