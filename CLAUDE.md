# px-app — CC 作業メモ（repo が記憶装置）

PX の本番 app。R1.5（五人テスト）は branch `stage-r15-five-test`（PR #1, base=spine）。
グローバルの働き方は `~/.claude/CLAUDE.md`。ここには**この repo 固有の手順と罠**だけを置く。

## R1.5 /meet の構え

- レーン分離（gate が pin）: `lib/rig`（凍結コア・law）/ `lib/meet`（copy・禁止語）/
  `lib/meet-memory`（owner-local IndexedDB; fetch 禁止）/ `lib/meet-net`（fetch=api.ts のみ・
  localStorage=local.ts のみ）/ `lib/meet-ai`（provider 直 fetch=generate.ts のみ）。
- 憲法: サーバが持つのは公開射影・話してみる・mutual 後の連絡メモ・テスト開示の log・
  問いの serve 日次カウント（閲覧者列なし）だけ。PX は AI を実行しない。非ranking。
- **沈黙の禁止**: 探しに行く／見回りの結末は必ず entry になる（faceOfEntry 5面、MA-10/10b/11）。
- gate テストが仕様の正本。挙動を変えたら pin を「期待の追従」として更新し、理由をコミットに書く。

## デプロイ（px-r15 = 五人テスト専用 Pages project）

```powershell
npm run build                                                  # out/ を生成（_headers 同梱）
npx wrangler d1 migrations apply px-app-board --remote          # ★migration が先（0009 まで適用済）
npx wrangler pages deploy out --project-name px-r15 --branch stage-r15-five-test --commit-dirty=true
```

- **罠: `--branch main` は Preview 扱い**（secrets 無し→Basic 認証 401）で px-r15.pages.dev は更新されない。
  production branch は `stage-r15-five-test`。
- **プレビュー確認（c11 Phase 0 で開通）**: px-r15 の Preview 環境には secrets を CLI で置けない
  （`wrangler pages secret put` は production のみ）→ 別プロジェクト **px-r15-preview**
  （production branch=`preview-go-check`・BETA/FACILITATOR secrets 設定済・**D1 は本番と共有**）。
  更新は `npx wrangler pages deploy out --project-name px-r15-preview --branch preview-go-check --commit-dirty=true`。
  URL は px-r15-preview.pages.dev（資格情報は本番と同じ）。**テスト終了後に project を削除する。**
- **罠: HTML キャッシュ**。`public/_headers` が HTML=no-cache / `/_next/static`=immutable を配る
  （第8便の沈黙 regression の真因）。_headers では catch-all を `!` で解除しないとルールが合成される。
  既にキャッシュ済みの端末には効かない→その場合はハードリロード（Ctrl+F5）を案内。
- 本番アクセス情報（BETA user/pass・進行役の合鍵）は `Desktop\px-r15-access.txt`（コミット禁止・チャット非経由）。

## ローカル smoke ループ

```powershell
npx wrangler pages dev out --port 8788          # .dev.vars: BETA_USER/BETA_PASS/FACILITATOR_KEY
npx wrangler d1 execute px-app-board --local --command "DELETE FROM r15_pool_item; DELETE FROM r15_signal; DELETE FROM r15_contact_note; DELETE FROM r15_log; DELETE FROM r15_question_serve;"
.\scripts\r15-smoke.ps1                          # API 18項目 + seed（あや/カフェの人）
node scripts\r15-ui-smoke.mjs                    # UI 一周（モバイル）
node scripts\r15-batch9-smoke.mjs                # 最新便の実機（実 Ollama）
```

- 便別 smoke: batch2（問いを置く/書き方射影）・batch3（provenance/読み自動保存）・
  batch4（伏せ字の反転）・batch7（紹介/basis）・batch8（沈黙の禁止・モック6経路）・
  batch9（見回り/気配）・ollama-smoke（接続表示）・responsive-sweep（4幅×4面）。
- スクショは `C:\Users\User\Desktop\スクショ\r15<x>-NN.png`（コミットしない）。

## 既知の罠（実地で踏んだもの）

- **prerender**: ページ直下の `useState(() => localStorage系)` は build を落とす（effect で初期化する）。
- **forbidden scan は識別子も見る**: 変数名 `best` が "best" で MA-3 に引っかかった例あり。
- **deploy 版 → localhost Ollama**: CORS は `OLLAMA_ORIGINS`（user env 設定済）、加えて Chrome の
  **Local Network Access 許可**が要る（Playwright では `grantPermissions(['local-network-access'])`）。
- **qwen2.5-coder:7b** は配線確認用。今日は無い／JSON 形式は守るが、言い換えの品質は低い。
  品質評価は Hiroto のブラウザ（Claude 実鍵）で。want の無い記憶では law どおり「今日は無い」を返す
  （smoke の記憶 fixture には want を必ず入れる）。
- wrangler dev は `_headers` を**起動時に読む**——変更したら再起動。

## RIG_LAW

`lib/rig/rig.ts` は px-table（法の原本）からの移植。文言改訂は Hiroto 裁定→両 repo 同期
（直近: rule 9 改訂 = px-table PR #36）。rig-gates.test.ts の独立 verbatim copy が drift を検知する。

- **同期課題: rule9はpx-appで3行版（2026-06-11裁定）。px-table原本（d0b8c29・2行）は未同期。
  次のpx-table便で同期すること。**
