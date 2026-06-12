-- R2 0010 — item_ref（公開項目の安定 identity）と r15_edge（接点単位の合図）。
-- 設計の正本: docs/r2/0010-edge-and-item-ref.md（ゲート通過 2026-06-12）。
--
-- 規律: 本 migration はカットオーバーゲートまで本番 px-app-board へ --remote 適用しない。
-- dev 適用: npx wrangler d1 migrations apply px-app-board-r2dev --remote --config wrangler.r2dev.toml
--
-- item_ref は端末が mint する公開用 alias（raw internal id は決して乗らない — 0010 invariant 5）。
-- 取り下げ→再公開で同じ alias が続くので、edge の basis_item_ref は publish を跨いで安定。
ALTER TABLE r15_pool_item ADD COLUMN item_ref TEXT NOT NULL DEFAULT '';

-- 同一 owner 内の alias 重複を物理で拒否（publish はアプリ層でも検証するが、床はここ）。
-- item_ref = '' は legacy 行（カットオーバー前の本番形）にだけ許される過渡値。
CREATE UNIQUE INDEX idx_r15_pool_item_ref
  ON r15_pool_item (participant_ref, item_ref)
  WHERE item_ref != '';

-- ── 接点（edge）— サーバが持つのはメタデータのみ。提案本文なし・点数なし・理由なし ──
CREATE TABLE r15_edge (
  edge_id        TEXT PRIMARY KEY,            -- 端末 mint・不透明（edge_ 接頭辞; r15pair_ は backfill 予約）
  a_ref          TEXT NOT NULL,               -- この接点で最初に手を挙げた側（出自の記録）
  b_ref          TEXT NOT NULL,               -- 宛先
  basis_item_ref TEXT NOT NULL,               -- b の公開項目（提案の根拠・歴史的ポインタ）
  proposal_ptr   TEXT NOT NULL DEFAULT '',    -- a 端末の recv entry+card への不透明ポインタ（本文なし）
  anchor         TEXT NOT NULL DEFAULT '',    -- 紙の床: basis が消えても前室が読める一行
  from_name      TEXT NOT NULL,               -- a の公開 pseudonym（送信時点）
  state          TEXT NOT NULL CHECK (state IN ('sent','mutual','closed')),
  closed_by      TEXT NOT NULL DEFAULT '',    -- closed の actor ref（reason 列は作らない — invariant 4）
  created_at     TEXT NOT NULL,
  last_act_a_at  TEXT NOT NULL,               -- a の行為の最終時刻（読みは行為ではない — invariant 2）
  last_act_b_at  TEXT NOT NULL DEFAULT ''     -- b の行為の最終時刻（'' = まだ行為なし）
);
CREATE INDEX idx_r15_edge_a ON r15_edge (a_ref);
CREATE INDEX idx_r15_edge_b ON r15_edge (b_ref);

-- ゲート条件1: 同一接点の重複 live edge 防止。
--   state != 'closed'    → T6「再会は同 pair の新 edge」（同じ項目での再会も含む）を妨げない
--   basis_item_ref != '' → backfill 疑似 edge（basis 空）同士の衝突を除外（⛔両案の無矛盾）
CREATE UNIQUE INDEX idx_r15_edge_live_triple
  ON r15_edge (a_ref, b_ref, basis_item_ref)
  WHERE state != 'closed' AND basis_item_ref != '';
