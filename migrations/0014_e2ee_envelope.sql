-- R2 0014 — E2EE 封筒と鍵配布（docs/r2/0013-e2ee-envelope.md・ゲート通過 2026-06-12）。
-- ※0013 は欠番（適用後に気づいた採番ミス — ゲート文書番号 0013 と取り違えた。
--   適用済みの名前は wrangler の台帳キーなので改名しない。欠番は無害）。
-- 規律: カットオーバーゲートまで本番 px-app-board へ --remote 適用しない。
--
-- r15_enc_key: 公開鍵（公開射影と同じ階級の公開物）。プール離脱で消えない —
-- 可達性分離（封筒は pool 在籍不要）が鍵にも要る。秘密鍵はサーバに存在しない。
CREATE TABLE r15_enc_key (
  participant_ref TEXT PRIMARY KEY,
  enc_pub         TEXT NOT NULL,              -- JWK (EC P-256 public)・公開物
  gen             INTEGER NOT NULL DEFAULT 1, -- 鍵世代（変更の事実表示用・判定なし）
  updated_at      TEXT NOT NULL
);

-- r15_envelope: ciphertext の運び台。PX は本文を読めない（平文を受ける API 形は
-- 存在しない — 0013 invariant 1）。メッセージ/渡す=流れる（配達後非保持・ack で
-- 行削除）、ノート=立つ（edge に従属 — 縁が閉じれば立て札も畳まれる・invariant 3）。
CREATE TABLE r15_envelope (
  envelope_id  TEXT PRIMARY KEY,              -- 端末 mint（env_ 接頭辞・形で検証）
  edge_id      TEXT NOT NULL,                 -- 宛先 edge（mutual のみ受理 — SQL 述語）
  from_ref     TEXT NOT NULL,                 -- 送信主体（token 由来・出自 — invariant 4）
  kind         TEXT NOT NULL CHECK (kind IN ('message','note','contact')),
  eph_pub      TEXT NOT NULL,                 -- 封筒ごとの ephemeral 公開鍵 (JWK)
  iv           TEXT NOT NULL,
  ciphertext   TEXT NOT NULL,                 -- base64・上限はアプリ層 16KB
  state        TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held','expired')),
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_r15_envelope_edge ON r15_envelope (edge_id);
-- ノートは「一人一枚・編集可」— (edge, author) で一行に upsert
CREATE UNIQUE INDEX idx_r15_envelope_note
  ON r15_envelope (edge_id, from_ref) WHERE kind = 'note';
