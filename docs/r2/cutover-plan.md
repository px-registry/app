# カットオーバープラン — R2 完成形を five-test 本番へ

状態: **実施済み（2026-06-12・Hiroto「カットオーバーGo」）。** 実施記録:
- Phase 0 ✅ バックアップ=tmp-cutover-backup.sql（44KB・ローカル・コミットしない）／ロールバック座標=旧 deployment `696a41db`
- Phase 1 ✅ 0010/0011/0012/0014 を px-app-board へ適用・pool 27 行無傷・新テーブル 0 件
- Phase 2 ✅ no-op 再確認（mutual 0 のまま）。※dry-run の訂正: "HIroto　Konishi" ref はスペルミスの重複入力（同一端末）・岡山カフェ=テスター — **typo ref の掃除は別 Go**（下記残件）
- Phase 3 ✅ 空集合完了（平文 contact_note 0 件・新ビルドは E2EE のみ書く）→ **R8 hook arm 済**（px-guard.r8-armed）
- Phase 4 ✅ deploy（px-r15・読み取り検証: 401/200・pool 27 行・itemRef/business serve・legacy alias='' は設計どおり）
- 残: **完了後のテスター告知（Hiroto・Ctrl+F5 一行＋「候補を更新する」を一度=alias と鍵が生える）**／typo ref（3ae9bd…・pool 12 行＋signal 1 行）の掃除 Go／旧 /api/meet/contact 書込端点の退場（設計役卓へ）

（以下、当初の設計図を記録として保存）
前提: 台帳 = docs/r2/cutover-ledger.md（8件）。テスト継続中の切替（「本日の完成版を本テストとする」裁定）。
原則: **additive のみ・各 phase に検証と中止線・巻き戻しは出自で機械的に。**

## Phase 0 — 凍結点（準備・本番不触の作業のみ）

- 本番 D1 の全量バックアップ: `wrangler d1 export px-app-board --remote --output tmp-cutover-backup.sql`
  （実行は Go 後・ファイルはコミットしない）。
- 現行 px-r15 の deployment id を記録（ロールバック座標）。
- **テスター告知枠**（文面は Hiroto 命名ゲート — ここは枠だけ）:
  - 前日: 「明日、画面が新しくなります」＋変わる点 3 行（アンテナの名前／取り下げる・閉じるが増える／
    連絡メモの渡し直しのお願い）＋変わらない点（記憶・下書きは残る）。
  - 当日完了後: 「終わりました」＋初回は Ctrl+F5 の一行（_headers キャッシュの既知の罠）。
- 中止線: バックアップが取れない → 全停止。

## Phase 1 — migrations 0010〜0012 の本番適用

- `npx wrangler d1 migrations apply px-app-board --remote`（0010 edge/item_ref・0011 close facts・0012 旗）。
- **additive の確認済み事実**: 旧コード（稼働中の five-test ビルド）は新列・新テーブルを参照しない —
  適用しても挙動不変。デプロイ前に適用できる＝DB とコードの切替を分離できる。
- 検証: `PRAGMA table_info` 相当の SELECT で列存在確認／既存 r15_pool_item 行数の前後一致。
- 中止線: migration エラー → そこで停止（additive なので戻し不要・旧状態のまま走行継続）。

## Phase 2 — backfill（テスター mutual の継承・デモの掃除）

**→ no-op 確定（2026-06-12・dry-run 実測を Hiroto 目視 OK）**: 本番の相互ペア=0・片方向 signal 1本
（Hiroto 自身のテスト）・smoke seed 不在・contact_note 0件 — **継承する縁も消すデモも存在しない**。
backfill スクリプトは書かない。カットオーバー直前に同じ dry-run を再実施し、mutual が生まれていたら
このフェーズを復活させる（手順は下記を温存）。

（温存）裁定: **テスターの mutual は残す・デモ edge は消す（出自で分別）。**

1. **dry-run（読み取りのみ・Go 前に実施可）**: 既存 r15_signal の相互ペア一覧と、各 ref の
   display_name を列挙 → **Hiroto が「テスター／デモ」を目視で確定**（あや・カフェの人等の
   smoke seed は名前で機械抽出できるが、最終分別は人間の一読 — 誤分別は縁の捏造/抹消になるため）。
2. backfill INSERT: 確定テスター相互ペア → `r15pair_<a>_<b>` edge（state=mutual・basis 空・
   anchor=旧 signal.anchor・to_name/from_name=旧行の名前）。**closed_from は空のまま**。
3. デモ行の削除は **r15_signal の行を消すのではなく**、backfill の対象に入れない（歴史=r15_signal は
   档案として不触・serve はもう読まない — 0010 §6）。
4. 検証: backfill 件数 = dry-run 確定数／`r15pair_` 行の SELECT 一覧を Hiroto へ。
5. 巻き戻し: `DELETE FROM r15_edge WHERE edge_id LIKE 'r15pair_%'` — **出自接頭辞だけで全行特定**
  （ゲート条件2の配当・端末 mint 行に副作用ゼロ）。

## Phase 3 — contact_note の E2EE 移行（0013 通過・実装後）

- 窓を二段で:
  1. **二重読み窓**（〜7日・仮）: 新ビルドは平文行と E2EE 封筒の両方を読む。各 owner の次回訪問時、
     クライアントが**自分の書いた**平文メモを自分の手で E2EE 封筒に出し直し → 成功後に平文行を
     自分の行為として削除（PX が平文に触れて変換しない — 移行も owner の行為）。
  2. **窓の終わり**: 告知済みの期日に残存平文行を削除（予告つき終了時削除の裁定）。削除前に件数を
     Hiroto へ報告（誰の分が未移行かは ref のみ・本文は読まない）。
- R8 hook（平文 contact 書込の復活遮断）をこの完了と同時に arm。
- 中止線: 二重読み窓で E2EE 側の不具合 → 窓を延長（平文を消すのは検証が green の後だけ）。

## Phase 4 — デプロイ（コード切替）

- `npm run build` → `npx wrangler pages deploy out --project-name px-r15 --branch stage-r15-five-test`
  （**Go 必須** — production branch 名の罠は CLAUDE.md 記載どおり）。
- 検証（本番を汚さない順で）:
  1. read-only: `/meet/` 200・pool serve に itemRef/business 列・inbox 形。
  2. **実機一周は Hiroto の実 owner で**（合成 owner の publish は本番プールに見えるため不可。
     どうしても合成が要る場合は夜間・即削除・進行役告知つき — 既定は Hiroto 実機）。
  3. テスター端末の下書き: fnote lazy 移行は初回読み出しで自動（特別作業なし）を確認。
- 巻き戻し線: 致命 bug → 旧 deployment id を re-publish（**D1 は additive なので旧コードと両立** —
  DB を戻さずコードだけ戻せる。これが Phase 1 を先行させる理由）。

## Phase 5 — 後始末（テスト終了時・本カットオーバーとは別の Go）

- research mode の構造的失効（r15_log レーン・読みチップ帯の撤去）／px-r15-preview project 削除／
  内部 tag「問い」改名（任意）／prompt heading のアンテナ寄せ（law/prompt sync 便）。

## 順序の根拠（一行）

**DB 先行（無害）→ 出自つき backfill（巻き戻し可）→ コード切替（単独で戻せる）→ 平文の終い（最後・
予告つき）** — どの phase で止まっても、その時点が安全な静止点になる並び。

## 裁可欄

Hiroto: 【Go（phase 単位）／修正指示】 — Phase 2 の dry-run のみ読み取りなので Go 前に実施可能。
