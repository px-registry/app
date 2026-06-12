# カットオーバー台帳 — R2 完成形を five-test 本番へ渡す日のための積み残し

**全項目が freeze 解除の判断を伴う — 専用の移行プラン便で一旦止めて Hiroto Go を取る。**
（/auto 停止線2: 本番接触の一切。この台帳は「忘れない」ための記憶装置で、着工指示ではない）

| # | 項目 | 中身 | 出自 |
|---|---|---|---|
| 1 | migration 0010/0011 の本番適用 | px-app-board へ --remote（additive のみ・適用順そのまま） | 便2/便3 |
| 2 | backfill | テスターの mutual ペア → 疑似 edge（`r15pair_` 出自・basis 空・anchor 床）。**デモ edge（あや等 seed 由来）は消す** — 出自で分別（デモ seed の識別キーは実装裁量・r15pair_ と別系統） | Hiroto 裁定 2026-06-12 |
| 3 | contact_note の E2EE 移行 | 平文 r15_contact_note → 完成版 E2EE 封筒（本日の完成版を本テストとする）。予告と移行手順込み | 同上 |
| 4 | 旧レーンの退場確認 | r15_signal serve 退場済（読みは無い・行は档案）／hidden-signals は便4 で退場済（後継=pxmeet:dismissed-edges・テスター端末の旧キー pxmeet:hidden-signals は無害な残骸 — 掃除は任意）／**旧 /api/meet/contact 書込端点と平文 notes serve は退場済（2026-06-12 一括 GOAL 便・r15_contact_note の表は档案で残置）** | 便2-4・GOAL便 |
| 5 | 内部 tag「問い」の改名 | **任意・急がない**（気配 serve が tag 値を見るため、改名は serve と同便で） | 便3 判定 |
| 6 | prompt heading 【今日の問い】のアンテナ寄せ | **law/prompt sync 便で**（rule9 級の同期作業・UI 改名とは別系。一時的には可・長期では負債） | 便3 判定 |
| 7 | research mode の構造的失効 | テスト終了時（r15_log レーン・読みチップの帯）— 構造で失効させる（環境撤去型） | spec §3・Wave5 |
| 8 | px-r15-preview project 削除 | テスト終了後（既存 CLAUDE.md 記載の再掲） | R1.5 |
