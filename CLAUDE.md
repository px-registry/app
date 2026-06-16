# px-app — CC 作業メモ（repo が記憶装置）

PX の本番 app。R1.5（五人テスト）は branch `stage-r15-five-test`（PR #1, base=spine）。
グローバルの働き方は `~/.claude/CLAUDE.md`。ここには**この repo 固有の手順と罠**だけを置く。

- 設計正典: `MEET_FINAL_SPEC.md`（R2以降の指示書は§番号で引用）
- 事業正典: `PX_BUSINESS_CONTRACT.md` v0.6
- 凡例: PX_BUSINESS_CONTRACT 文中の git ハッシュ（v0.3〜v0.5 zone 内の 97a99ce・2a6be92 等）は
  移植前アーカイブ repo のもの — この repo の履歴では引けない（53e6466 で byte-stable 移植）。

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

## R2 完成形建設（stage-r2-complete）

**隔離現場（便1 開設・2026-06-12）** — five-test 本番を実験台にしない:

- branch `stage-r2-complete`（4218d5c 起点）。`stage-r15-five-test` は凍結（hotfix cherry-pick も Hiroto Go 必須）。
- 資源は名前ごと分離: D1 `px-app-board-r2dev`／KV `AUTH_R2DEV`／R2 `px-app-deliveries-r2dev`。
  binding 名（BOARD/AUTH/DELIVERIES）は本番と同一・実体だけ dev — コードは分岐しない。
- Pages project **px-r2-dev**（px-r2-dev.pages.dev・Basic Auth あり・secrets 設定済）。
  アクセス情報は `Desktop\px-r2-dev-access.txt`（コミット禁止・チャット非経由）。
- smoke（scripts\r2-edge-smoke.mjs）の罠2つ: ①R2_USER/R2_PASS/R2_BASE は**同一コマンド内**で
  設定して実行（シェル状態は呼び出し間で消える — 別呼び出しだと全 401）②**実行前に dev D1 を掃除**
  （edge id が固定定数のため、残骸があると冪等でない）。
- deploy は `scripts\deploy-r2dev.ps1` だけを使う。**罠（実測）: `wrangler pages deploy` は
  `--config` を受けない**（"Pages does not support custom paths"）→ スクリプトが wrangler.toml を
  一時差し替えて finally で必ず復元する。`d1 migrations apply` は `--config wrangler.r2dev.toml` が効く。
- **migration 規律: 0010 以降を本番 `px-app-board` へ `--remote` 適用しない**（カットオーバーゲートまで）。
  dev への適用は `npx wrangler d1 migrations apply px-app-board-r2dev --remote --config wrangler.r2dev.toml`。

**信号機運用（Hiroto 裁定 2026-06-12・最終形 — 下の停止線リストを置き換える）**

- **赤（必ず停止・例外なし）**: 本番データ削除／schema 破壊（DROP・破壊的 ALTER・additive 以外）／
  private・鍵・平文の漏れ形／law 変更（RIG_LAW・rule9 系）／ランキング・課金化の忍び込み／main 直 push。
  hook と pin が大半を機械で見ているが、**機械が黙っていても該当すると判断したら止まる**。
- **黄（一行対話 — 傾きを示し、異議がなければ進行。返答を待たずに他の作業は続けてよい）**:
  サーバデータの追加（additive な migration・新 endpoint）／ゲート済テーブルへの追補列／
  新規 user-facing 文言（候補と傾きを添えて投げる）／allowlist 追記。
- **緑（/auto・報告のみ）**: それ以外すべて。設計判断は CC のもの。完成形を証拠つき報告で。
- 現行 GOAL（2026-06-12 一括）: Dock L2/L3・チャットポート P0→P1・はじめかた二扉化・小掃除完済・
  Wave4 前倒し可能分。**終了条件 = 1〜4 が本番で動き、テスターとチャット LLM の両方から同じ部屋に
  入れる状態**（この GOAL 内の本番 deploy は終了条件が裁可 — 赤に触れない形で）。
  R4（AI 相互読解・injection 硬化・縁の記録戸口）は設計メモのみ・実装は待て。
  **→ 達成（2026-06-12 本便）**: px-r15 本番に deploy 済・実チャット LLM（claude -p + MCP）で
  本番 port 一周を確認（law 読み→候補読み→「今日は無い」の正直）。R4 メモ= docs/r2/r4-design-notes.md。
- polish 便（2026-06-13・984e1da まで本番反映済）: 二態の対句（看板調=二扉見出し級のみ・本文です調・
  不足新文は STOP④・「世界中」は UI 不可=ブランド層）／Antenna 見出し・探しにいく（ひらがな）対ボタン・
  時間帯 placeholder v1。**能動側テーマ語は空席（命名台帳・設計役）— 観察項目: テスターが
  「探してもらう」をどう言い換えるか**。
- **墨工房 cutover（2026-06-16・本番反映＝px-r15 を `24641ff` へ）**: ワークスペース器＋墨テーマ
  composer UI 語彙（◆/◇・outline ring・色ドット）＋rail 短語（Antenna/Finds/Talk/Setup・あなたのAI は
  FAB）＋入力欄を箱に＋Setup 案A（二扉＋details 入れ子）。**migration ゼロ（live↔HEAD 完全一致・D1 非接触）。**
  - 旧 live `4e04651` の「探しにいく」失敗の真因＝**旧 storage 層の例外**（LLM は 200 成功・shelf.add=IndexedDB
    書込で throw → errorCode "unknown"）。HEAD が storage 層を作り直し済み（**IndexedDB VERSION 5→7**・
    onupgradeneeded で既存ストア不触＝データ消失なし）＝cutover が修正。D1・鍵・CORS は無関係（実測 200）。
  - **rollback 座標（即戻し）**: 旧 live deployment ID `94c0613a-97c7-45f8-b139-79ad5860a055`（commit 4e04651）。
    新 live `2bca88bb-...`（24641ff）。戻すなら Cloudflare ダッシュボード rollback。
  - 検証分担: 無認証401・deploy live は CC 実測済。認証200・rail4道具・紙↔墨・FAB・「探しにいく成功」・
    IDB 前進は Hiroto のブラウザ（鍵・合鍵は端末／bot を本番に当てると owner token を mint し気配を曇らせる）。
- **次便 = 記憶装置（合流点）**: 指示書 `C:\Users\User\Desktop\PX_MEMORY_DEVICE_thread_v0.1.md`。
  **設計対話から・実装は Hiroto Go・フレッシュセッション推奨**。合流する既存部品: port 六道具の
  内側再利用（常駐対話窓=UI規格同格原則）・0013 パスフレーズ封緘（鍵部品は本番稼働済）・
  受け皿三原則（memory: px-memory-vessel.md）・後日談ループ・Dock。§3 問い束の本丸=5（アンテナの世話
  — AI が owner の探しごとの庭師になる）。

**チャットポート（/port/mcp・本便開設）**

- MCP streamable HTTP・stateless・POST のみ（GET=405）。認証 = owner token（Bearer か ?k=）—
  `_middleware` は `/port/mcp` ぴったりだけ Basic を免除し、port 自身が fail-closed 401。
- 道具6: get_law_and_manifest / read_candidates / read_inbox / place_question / send_signal /
  draft_talk_link。**平文のトーク本文を受ける tool は無い**（0013 invariant 1 — 下書きは
  チャットが `#draft=` フラグメントに乗せ、封緘・送信は端末の既存動線）。
- place_question は additive 挿入＋**reverse-import**（inbox.myItems → 端末が次回訪問で取り込み
  alias を adopt — replace-publish で消えない）。
- smoke: `scripts/r2-port-smoke.mjs`（API 24検査）・`scripts/r2-goal-ui-smoke.mjs`（UI 18検査・
  実 Ollama の Dock L2 生成込み）。チャット実機は
  `'<prompt>' | claude -p --mcp-config tmp-port-mcp.json --strict-mcp-config --allowedTools "mcp__px__*"`
  （罠: prompt は stdin で渡す — 引数の位置によっては -p が食う）。

**/auto 運転規約 — stage-r2-complete（Hiroto 裁定 2026-06-12・便1 から適用・歴史として保存）**

既定＝/auto。下の停止線でのみ止まる。それ以外で確認を求めない。

止まる（auto 免除なし・従来どおり）:
1. 4 STOP（設計曖昧／憲法・境界＝サーバデータ新設・意味拡張・公開射影の変更含む／不可逆破壊／命名＝ゲート済文言なき新規 user-facing 文言）
2. 本番接触の一切: px-r15・px-table 本番への deploy／px-app-board（本番 D1）への --remote 適用／stage-r15-five-test への変更（hotfix cherry-pick も Go 必須）
3. origin push（Hiroto 裁可制・インシデント以来の恒久線）
4. ⛔印（Hiroto 裁定待ち: backfill・E2EE 既存行・命名束・熱量語彙）＝設計まで進めて実装停止
5. Wave ゲート文書の通過前実装（0010 等の STOP②文書は対話で通してから）
6. 秘密・鍵（deny 継続・探さない）

運用線（便3 判定で追加・2026-06-12）: **ゲート済テーブルへの追補列は、実装前に対話へ一行**
（「この裁定は◯◯列を要求する — 異議あるか」・往復一回でよい・フルゲート再走は不要）。
STOP② の縁を黙って跨ぐ前例を作らない。

push 常設（2026-06-12 裁定）: **stage-r2-complete への push は常設可（hook 発火プローブの
確認後に有効）。他 branch は従来どおり裁可制。本番線（停止線2）は不変。**
次セッション冒頭: プローブ →「px-guard 遮断[push]」確認 → 以後 push は止まらない。

auto で進めてよい（止まらない・迷わない）:
- stage-r2-complete へのローカルコミット（atomic 維持）／編集・テスト・build・lint
- dev D1（px-app-board-r2dev）への migration 適用・seed・掃除 — 何度でも
- px-r2-dev への deploy — 隔離面は建設現場。回数自由・Go 不要
- 依存追加（allow リスト準拠）／smoke・fixture 整備／CLAUDE.md・docs 追記（正本 verbatim 原則は維持）

報告律動: 便の終わりに証拠つき報告（テスト数・smoke・スクショ・コミット列・罠と学び）。便中は STOP 時のみ発話。
**運用線（2026-06-13・設計役）**: 観察期間中の本番 read（pool serve・port read_candidates 等）は
気配の数字を曇らせる — **必要最小・実施記録つき**でだけ行う（テスターの気配は人間を映す）。
**迂回の常時報告（恒久・2026-06-12 昇格）**: 守り（permission/deny 等）を迂回する操作は、内容が無害でも
必ず報告に明記する（便1 のワイルドカード削除の報告形が規範）。
Phase 0.5 の設計対話は Wave ゲートごとに従来どおり（auto は便内の手の速さであって、Wave 間の対話を省く話ではない）。

**一行原則: auto は速度の話で、決定権の話ではない。止まる場所は減らさない。止まらない場所で迷わない。**

## ローカル smoke ループ（R2 現役）

```powershell
npx wrangler pages dev out --port 8788          # .dev.vars: BETA_USER/BETA_PASS/FACILITATOR_KEY
npx wrangler d1 execute px-app-board --local --command "DELETE FROM r15_pool_item; DELETE FROM r15_edge; DELETE FROM r15_envelope; DELETE FROM r15_contact_note; DELETE FROM r15_log; DELETE FROM r15_question_serve; DELETE FROM r15_enc_key;"
node scripts\r2-edge-smoke.mjs                   # edge/封筒/閉じ系（R2 の正本 smoke）
node scripts\r2-port-smoke.mjs                   # チャットポート API（要: 事前掃除）
node scripts\r2-goal-ui-smoke.mjs                # UI 一周（二扉/pair面/#draft=/Dock L2・実 Ollama）
```

- **ワークスペース器 smoke（第2便〜）**: `scripts\r2-ws-smoke.mjs` は rail＝toolbar・canvas
  一面切替・あなたのAI 窓トグル・キーボード roving を実ブラウザで見る。**Ollama 不要**
  （切替は client state のみ）。2手: `python -m http.server 8099 -d out &` → `node scripts\r2-ws-smoke.mjs`
  （要 playwright・chromium）。器の骨格の回帰ネット。

- **退役（2026-06-13）**: r15-ui-smoke.mjs は pre-R2 の signal 形で恒久 stale → 削除（歴史は git）。
  r15-smoke.ps1 も同 stale — R2 では使わない（档案として残置）。
- 便別 smoke（R1.5 期・対象機能の回帰確認にだけ使う）: batch2-9・c17・ollama-smoke・responsive-sweep。
- スクショは `C:\Users\User\Desktop\スクショ\r2g-NN.png`（コミットしない）。

## 既知の罠（実地で踏んだもの）

- **Pages secrets は次の deploy から効く** — `wrangler pages secret put` 直後の稼働中 deployment
  には反映されない（px-r2-dev rotate で実測・再 deploy で解決）。
- **scripts/r15-ui-smoke.mjs は pre-R2 で stale**（signal seed が edgeId/basisItemRef 無しの旧形 —
  0010 以降は通らない）。現役 UI smoke は r2-goal-ui-smoke.mjs。改修か退役は次便で判断。
- **legacy alias 残（本番）**: pool 15 行すべて item_ref 無し（2026-06-12 実測）。テスターが
  「候補を更新する」を一度押すまで、その候補への 話してみる は basis 不在で押せない —
  カットオーバー残のテスター告知（Hiroto）が前提。port の place_question 行は mint 済みで即可達。
- **EV-2 の flake（修正済）**: base64 末尾グループの反転は padding 捨てビットで no-op になり得る
  （~6%）— tamper 試験は先頭文字を反転する。

- **prerender**: ページ直下の `useState(() => localStorage系)` は build を落とす（effect で初期化する）。
- **forbidden scan は識別子も見る**: 変数名 `best` が "best" で MA-3 に引っかかった例あり。
- **deploy 版 → localhost Ollama**: CORS は `OLLAMA_ORIGINS`（user env 設定済）、加えて Chrome の
  **Local Network Access 許可**が要る（Playwright では `grantPermissions(['local-network-access'])`）。
- **qwen2.5-coder:7b** は配線確認用。今日は無い／JSON 形式は守るが、言い換えの品質は低い。
  品質評価は Hiroto のブラウザ（Claude 実鍵）で。want の無い記憶では law どおり「今日は無い」を返す
  （smoke の記憶 fixture には want を必ず入れる）。
- wrangler dev は `_headers` を**起動時に読む**——変更したら再起動。
- **px-guard が比較ソート（dot-sort）を遮断**（lib/meet-memory 等・ranking 忍び込み防止）。
  順序が要るなら比較でなく**位置で並べる**（記憶装置 journal は seq 単調増加・穴なし＝配列
  添字で order・`orderBySeq` in journal.ts が範例）。allowlist 追記での迂回は避けた。
- **提案エントリのセレクタは `.m-entry`**（`.m-item` は記憶リスト側）。batch3 smoke の
  `.m-item`/`.m-proposal` 待ちは旧マークアップ — 新 smoke を書くとき写さない（c16 で180s×2浪費）。
- **wrangler dev 起動中は `npx wrangler pages deploy` が EBUSY で落ちる**（npx キャッシュ共有）
  — dev を止めてから deploy。
- **owner token は home 初訪問で mint される** — smoke で `pxmeet:owner-token` を読むのは
  `/meet/` を一度踏んだ後（c17 で 30s タイムアウト1回浪費）。
- **呼び名が空のまま「こちらも話してみる」を押すと signal がサーバに弾かれて無反応**
  （fromName 必須・talkBack は結果を見ていない）。テスターは名前必須導線を通るので
  実害は smoke のみだが、R2 で沈黙の禁止に照らして要再訪。

## RIG_LAW

`lib/rig/rig.ts` は px-table（法の原本）からの移植。文言改訂は Hiroto 裁定→両 repo 同期
（直近: rule 9 v3 直行同期 = px-table PR #37、両 repo 同文確認済 2026-06-12）。
rig-gates.test.ts の独立 verbatim copy が drift を検知する。

## 設計原理（c14 記録）

- 翻訳は文脈が最も濃い場所で一度だけ（c11=送信側宛先反転、c14=取り込み時の他人向け翻訳）。
  下流での言い換え努力に頼らない。

## R2 課題（c12-2 記録）

- c18: sent 状態は **ペア単位**（inbox.outgoing の toRef 集合）— 同一相手の全カードが
  一斉に「伝えてあります」になる。カード（edge）単位化は signal のスキーマ変更が要るため R2。
  対応§: spec §10（文脈の鮮度原則 — 相手単位は過渡形、最終形は edge 単位）。
- プール離脱と可達性の分離（c18 peer_not_in_pool: 取り下げ＝即・不可達の現状）。
  対応§: spec §10（状態機械 — dormant は削除でない）・§11-8（眠る縁・目覚める縁）。
- 合図削除API（送った合図をサーバ側からも取り下げ・片づけられる経路）。
  対応§: spec §10（状態機械: dormant／closed）・§11-7（縁を畳む — owner の行為、PX 裁定なし）。
- EN文言の全面ゲート（現状ドラフト・既存文言は未訳）。
- EN表示書体 Cormorant Garamond の woff2 同梱（現状OSフォールバックで端末差が出る —
  Hiroto報告の2端末差の根因）。
- ひとこと紹介のAI下書きプロンプトへ c14 同原理（他人向け翻訳）の適用（c14 §3 記録）。
