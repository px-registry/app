-- R2 0015 — PX Device Mesh registry / relay（docs/r2/device-mesh-how-v0.3.md・STOP #0 条件付き GO 2026-06-17）。
-- Phase A: owner_ref / device registry / epoch registry ＋ relay/ack の器（put/fetch は Phase C）。
--
-- 規律（CLAUDE.md・STOP #0 境界）: 本番 px-app-board へ --remote 適用しない（カットオーバーゲートまで）。
-- 適用は local（--local）／dev（px-app-board-r2dev --remote --config wrangler.r2dev.toml）のみ。
-- 全 additive・既存テーブル不触。**平文本文・private key を一切持たない**（body は暗号文のみ・公開鍵のみ）。

-- owner の公開 routing 同一性（epoch 横断で安定）。peer はここ宛に送る。
CREATE TABLE r15_owner (
  owner_ref       TEXT PRIMARY KEY,           -- 安定・公開・不透明（32 hex）
  handle          TEXT NOT NULL DEFAULT '',   -- passkey handle への任意束ね（production hardening）
  participant_ref TEXT NOT NULL DEFAULT '',   -- 既存公開面 ref への写像（公開物どうし・private でない）
  current_epoch   INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- content epoch 公開鍵（暗号化宛先）。private は絶対に置かない（d 付き JWK は publish ごと拒否）。
CREATE TABLE r15_owner_epoch (
  owner_ref   TEXT NOT NULL,
  epoch       INTEGER NOT NULL,
  epoch_pub   TEXT NOT NULL,                  -- ECDH P-256 公開 JWK（isPublicEncJwk 検証）
  active      INTEGER NOT NULL DEFAULT 1,     -- 1=現在の wrap 宛先、0=退役（新規 wrap 不可）
  created_at  TEXT NOT NULL,
  PRIMARY KEY (owner_ref, epoch)
);

-- device registry（PX が持つのは公開鍵だけ・revoke 対象）。
CREATE TABLE r15_device (
  device_id   TEXT PRIMARY KEY,               -- 端末 mint（dev_ 接頭辞）
  owner_ref   TEXT NOT NULL,
  sig_pub     TEXT NOT NULL,                  -- ECDSA P-256 公開：relay 要求署名 ＋ device-add 認可
  enc_pub     TEXT NOT NULL,                  -- ECDH P-256 公開：handoff / epoch 鍵配布の wrap 宛先
  label       TEXT NOT NULL DEFAULT '',       -- owner が付ける端末名（owner 表示のみ・peer 非開示）
  added_at    TEXT NOT NULL,
  added_by    TEXT NOT NULL DEFAULT '',       -- 認可した device_id（'' = 初端末＝bootstrap）
  revoked_at  TEXT NOT NULL DEFAULT '',       -- '' = active
  last_epoch  INTEGER NOT NULL DEFAULT 0      -- この端末が受け取った最高 epoch（帳尻）
);
CREATE INDEX idx_r15_device_owner ON r15_device (owner_ref);

-- relay payload（一時配送 cache・正本でない・TTL＋全ACK purge）。put/fetch/ack は Phase C。
-- body は暗号文のみ・PX は平文を一切持たない。epoch id 明示・expires_at 列で TTL を正本化。
CREATE TABLE r15_mesh_payload (
  payload_id   TEXT PRIMARY KEY,              -- 端末 mint（mesh_ 接頭辞）
  audience_ref TEXT NOT NULL,                 -- 宛先 owner_ref（self lane=自分／peer lane=相手）
  lane         TEXT NOT NULL CHECK (lane IN ('self','peer')),
  ptype        TEXT NOT NULL CHECK (ptype IN ('memory-delta','talk-msg','talk-mirror','handoff','epoch-key')),
  epoch        INTEGER NOT NULL,              -- wrap 宛先 epoch id（verdict G2）
  wrap_to      TEXT NOT NULL DEFAULT 'epoch' CHECK (wrap_to IN ('epoch','device')),
  to_device    TEXT NOT NULL DEFAULT '',      -- wrap_to='device' のとき宛先 device_id（handoff/epoch-key）
  eph_pub      TEXT NOT NULL,                 -- ephemeral ECDH 公開（sealEnvelope）
  iv           TEXT NOT NULL,
  ciphertext   TEXT NOT NULL,                 -- base64・chunk 可・平文を一切持たない
  chunk_ix     INTEGER NOT NULL DEFAULT 0,
  chunk_of     INTEGER NOT NULL DEFAULT 1,
  state        TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held','expired')),
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL                  -- TTL の正本（put 時に確定・fetch 不可/GC 判定）
);
CREATE INDEX idx_r15_mesh_aud ON r15_mesh_payload (audience_ref, state);
CREATE INDEX idx_r15_mesh_exp ON r15_mesh_payload (expires_at);
CREATE INDEX idx_r15_mesh_todev ON r15_mesh_payload (to_device);

-- per-device 配送状態（最初の1台 ACK で他端末が取り逃さない・purge 判定の内部資料）。
-- counterparty にも presence にも一切出さない。
CREATE TABLE r15_mesh_ack (
  payload_id  TEXT NOT NULL,
  device_id   TEXT NOT NULL,
  acked_at    TEXT NOT NULL,
  PRIMARY KEY (payload_id, device_id)
);
