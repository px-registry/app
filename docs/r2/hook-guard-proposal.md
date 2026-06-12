# px-guard hook 提案 — PreToolUse の機械の守り（Hiroto 一瞥待ち・未設置）

状態: **起草完了・未設置。** settings は Hiroto 領分 — 一瞥と Go の後に下記 diff を設置する。
本体: `scripts/hooks/px-guard.mjs`（repo 同梱・コミット済み。`.claude/` は gitignore のため
hook 本体は scripts 側に置き、settings からそこを指す）。
原則: **fail-closed 可視** — 遮断は黙らない。何を・なぜ止めたかを一行で返す（沈黙の禁止の hook 版）。
判定できない入力は通す — このフックは「うっかりの網」で、深い守りは gate テストと境界設計が担う。

## ルール一覧（実測済み — 下の試験記録）

| id | 遮断するもの | 一行の理由 |
|---|---|---|
| push | `git push`（px-table を明示しないもの全て） | px-app の origin push は Hiroto 裁可制（恒久線） |
| main-commit | main/master が現在ブランチのときの `git commit` | 保護ブランチは branch→PR で積む |
| sort | `.sort(` を含む Edit/Write（allowlist 外） | 順位付けの忍び込み防止 — 止めて申告 |
| key | 鍵らしき文字列（sk-/sk-ant-/AKIA/ghp_/AIza…）を含む入力 | 鍵は端末の中だけ |
| prod-d1 | `px-app-board`（-r2dev を除く）への `--remote` | 本番 D1 は freeze（カットオーバーゲートまで） |
| prod-deploy | `--project-name px-r15*` / `px-app` への pages deploy | 本番接触は Hiroto Go |
| private-shape | `/api/meet/` への送信形に `private:` キー（エスケープ形含む） | private 本文は PX body に乗らない（c17 tripwire 常時化） |
| plain-contact | `INSERT INTO r15_contact_note` を足す編集（**休眠** — E2EE 移行後に `px-guard.r8-armed` ファイルを置いて起動） | 平文経路の復活は境界違反 |

## 誤検知時の owner override（Hiroto の行為・可視）

```powershell
$env:PX_GUARD_OVERRIDE = "<ruleId>"   # 例: "sort"
# …同じ操作をもう一度（一回ぶん通り、「override 消費」の一行が出る）
$env:PX_GUARD_OVERRIDE = ""           # 使い終わったら消す
```
黙って素通りしない: override が効いたことも一行で表示される。恒久的な許可は
allowlist（sort は `scripts/hooks/px-guard.mjs` の SORT_ALLOW）への追記で行い、コミットに残す。

**運用ノート（設計審査 2026-06-12）: override は道ではなく例外。** 正当な新 sort が必要に
なったら、override 一回 →「allowlist に◯◯を足す — 異議あるか」の**一行対話 → allowlist 追記
（コミット）**、の順で恒久化する。override の常用は allowlist の腐敗経路 — 二度目の override
を打つ前に必ず allowlist 対話へ。

## 設置 diff（Hiroto が settings.json に置く想定・global でなく px-app project 推奨）

```jsonc
// D:\px-app\.claude\settings.json （新規 or 追記）
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell|Edit|Write|NotebookEdit",
        "hooks": [{ "type": "command", "command": "node scripts/hooks/px-guard.mjs" }]
      }
    ]
  }
}
```

あわせて提案（同じ一瞥で判断可・どちらも Hiroto 操作）:
1. px-app `.claude/settings.local.json` の `"Bash(git push *)"` allow 行の削除（誤 push 事故の元）。
2. 名前の距離防壁（-r2dev）＋本フックで push/本番系は二重化 — ask 追加は不要と判断（prefix 一致が
   `git -C … push` 形をすり抜ける実測のため、ask では塞がらない）。

## 試験記録（2026-06-12・実行ログそのまま）

遮断（exit=2・一行つき）: px-app への `git -C D:\px-app push` ／ `px-app-board --remote` ／
`--project-name px-r15` deploy ／ copy.ts への `.sort(` 編集 ／ `sk-…` 鍵文字列 ／
`/api/meet/` への `\"private\":` payload（エスケープ形）。
通過（exit=0）: px-table の branch push ／ `px-app-board-r2dev --remote` ／ px-r2-dev deploy ／
received.ts の時刻順 sort（allowlist）／ `npm test`・smoke 実行 ／ stage ブランチでの commit。
override: `PX_GUARD_OVERRIDE="push"` で一回通り・「override 消費」の一行を表示。

## 既知の限界（正直に）

- hook はコマンド文字列と編集テキストを見る — アプリ自身の実行時挙動は見えない（そこは
  gate テスト・tripwire・境界設計の領分）。
- R1 は「px-table と書いていない push」を全て止める — px-table 作業を `Set-Location` 後の裸の
  `git push` でやると誤検知する（override か `-C D:/px-table` 明示で回避）。
- R2 は hook 内で `git branch --show-current` を実行する（5秒 timeout・失敗時は通す）。

## 裁可欄

Hiroto: 【設置 Go ／ 修正指示】（設置操作も Hiroto — CC は settings を書かない）
