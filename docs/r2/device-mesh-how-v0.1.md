# PX Device Mesh — Phase 0.5 HOW（実装前・草案 v0.2）

> 内部名 **PX Device Mesh**／表層 **Sync・端末をつなぐ**。
> **これは設計（HOW）だけ。実装しない。** server / schema / crypto に触れる重い面のため、
> 着手は Hiroto STOP #0 ＋四者レビュー後。新規 server data フィールドはすべて 🟥 STOP（憲法境界）。
> 確定設計（指示書の「鍵三種・三層・配送・revoke・delete・1対多」）は前提として動かさない。本書はその上に HOW を組む。
>
> **裁定確定（Claude＋GPT＋Hiroto・2026-06-17）— 本書に反映済み:**
> - **STOP-A**: `owner_ref` **新設**（participantRef を昇格しない・本番生データ backfill しない）。
> - **三語固定**: `owner_ref` ＝ 身元 / Mesh 正本 ／ `participantRef` ＝ 公開面の識別子 ／ `device_id` ＝ 個別端末。
> - **STOP-E**: 自分側の事実のみ可。相手の状態（届いた/読んだ/入力中/オンライン/相手端末の同期）は禁止（§4.7・§7.3）。
> - **STOP-C**: 非破壊。legacy `r15_envelope` は移さず legacy lane で残し、mesh は前向きのみ。一定期間 dual-read・bulk migrate なし・TTL/ack/cutover で自然退役（§2.7）。
> - **新 invariant（判定しない柱）**: dual-read の時刻/HLC 順序材料は **timeline 収束専用**。候補の品質/重要度/頻度/相性/順位に**一切流入させない**（§6.4）。
> - **STOP-D**: 確定コピー採用（§12）。
>
> **まだ閉じていないゲート（crypto/server 実装の前提）:**
> - GPT crypto 5点 verdict（rotation 前方遮断 / HLC+fold 収束 / handoff 信頼起点 MITM / 72h 一時滞留の許容 / mesh_payload purge 実効）。
> - Hiroto STOP #0（new-server-data 5テーブル / 命名 / edge_note 追補）。

---

## 0. 一行の核心（既存資産との差分）

今の px-app は **端末ごとに別人**だ。各端末は自分の `ownerToken` から `participantRef`（16hex）を導出し、
自分の enc keypair（`r15_enc_key`）を持つ。サーバから見ると同じ持ち主の2台は**別の参加者**に見える。

確定設計が新設する **owner content epoch keypair**（Memory/Talk 本文の暗号化宛先・端末横断で共有）は、
この「端末＝別人」モデルの**上**に乗る新しい層だ。既存の per-device envelope 暗号（ECDH+AES-GCM）は
**部品としてそのまま**使い、宛先だけが「相手端末の鍵」から「相手 owner の epoch 公開鍵」へ上がる。

→ Device Mesh の本質は **「端末横断の owner 同一性」と「その同一性を宛先にした relay」** を足すこと。
本文暗号も封緘も journal も、土台は既にある。

---

## 1. 既存資産マップ（再利用 / 新規の線引き）

| 資産 | 場所 | 役割（現状） | Device Mesh での扱い |
|---|---|---|---|
| **WebAuthn passkey** | `lib/webauthn/{enroll,assert,verify,register,…}` ＋ `functions/api/auth/{registration-challenge,register,assertion-challenge,verify,me,signout,profile}` | handle ⇄ P-256 公開鍵。session token（HMAC, 30日, HttpOnly cookie）。owner record は **KV `AUTH`** に `handle:{handle}`。 | ♻️ **そのまま owner identity 層**。**本人確認のみ**＝端末追加（device-add）と revoke のサーバ側ゲート。content 復号には一切使わない。 |
| **recovery code** | `lib/webauthn/recovery.ts` | 12byte→`XXXX-XXXX-XXXX`。平文は端末のみ、サーバは SHA-256 hash のみ（KV OwnerRecord）。 | ♻️ アカウント復旧の既存路。Mesh の content 復旧とは**別経路**（content は封緘 backup が担う・§3.6）。 |
| **envelope 暗号** | `lib/meet-crypto/envelope.ts` `sealEnvelope/openEnvelope` | ECDH P-256 ephemeral ＋ AES-256-GCM。失敗は **silent null**。 | ♻️ **本文・束・鍵配布のコア暗号**。宛先 pub を「端末 enc」から「epoch pub / device enc」に差し替えて再利用。 |
| **封緘 seal（0013）** | `lib/meet-crypto/seal.ts` `sealPrivateKey/openSealedKey` | PBKDF2-SHA256(310k)＋AES-256-GCM で private JWK を passphrase 封緘。誤 passphrase は **throw（fail-closed）**。 | ♻️ **owner backup**（既存端末ゼロからの復旧・§3.6）と、handoff 束の at-rest 保護に再利用。 |
| **enc keypair 部品** | `lib/meet-crypto/keys.ts` `mintEncKeyPair/isPublicEncJwk/encPubToString/parseEncPub` | ECDH P-256 生成。`isPublicEncJwk` が **`d`（private scalar）を拒否**＝公開のみ流通の番人。 | ♻️ epoch keypair・device enc keypair の生成と公開形検証に**そのまま**。 |
| **per-device enc 登録** | D1 `r15_enc_key`（participant_ref PK, enc_pub, gen, updated_at）＋ `/api/meet/{publish,enckey}` | 端末ごとの公開鍵レジストリ。`gen` が変更回数の正直な事実。 | ⚠️ **意味が変わる**。peer↔peer の宛先が epoch pub へ上がるため、Talk 配送の宛先としては **epoch pub に置換**。`r15_enc_key` は当面は per-device の補助として残置可（§2.7 で線引き）。 |
| **relay（envelope 配送）** | D1 `r15_envelope`（held/expired・TTL14日・read-time purge・ack=delete・note=standing）＋ `/api/meet/{envelope,envelope-fetch,envelope-ack}` | mutual edge 上の暗号文配送。**単一 ack で delete**（1宛先1端末前提）。 | ⚠️ **Mesh payload へ昇格**。確定設計「Talk は別系統を作らず Mesh に乗せる」より、flowing message を **per-device ack の mesh_payload へ移送**（§2.3）。standing `note` は edge-scoped として当面 `r15_envelope` 残置（§2.7）。 |
| **owner-local journal** | `lib/meet-memory/journal.ts`（store `journal`, keyPath `recordId`） | append-only・`seq` 単調増加（穴なし）・`orderBySeq`・`append/appendEvent/listSince(seq)/restore/get`・fold（forget/supersede/surface）。 | ♻️➕ **Memory 正本**。`listSince(seq)` が **delta の取り口**、forget event が **tombstone**、`restore` が **取り込みの土台**。ただし端末横断 merge には **順序鍵の拡張が必要**（§6：`seq` は端末内ローカル、横断は HLC へ）。 |
| **Talk 棚** | `lib/meet-memory/talk.ts`（store `talk`, keyPath `entryId`） | 受信=env id で idempotent put、送信=端末 mint。`thread(edgeId)` は `at`（時刻）順。 | ♻️ **Talk transcript 正本**。entryId dedup ＋ 時刻順 ＝ merge がほぼ union で済む（§6）。送信控えを self-lane で他端末へ mirror。 |
| **IndexedDB 基盤** | `lib/meet-memory/indexeddb.ts`（DB `px-meet` **VERSION 7**） | onupgradeneeded で既存 store 不触の incremental。 | ♻️ 新 store（device/epoch/mesh-cursor）を **VERSION 8** で additive 追加（既存データ不触＝消失なし）。 |
| **ワークスペース器・コピー** | `app/meet/MeetWorkspace.tsx` `MeetRail.tsx` `MemoryWindow.tsx` `start/page.tsx`／`lib/meet/copy.ts`／`lib/meet/forbidden.ts` | rail＋canvas＋FAB。Setup は二扉＋手順カード（`#step-key`/`#step-intake`/`#name`）。コピー集中・禁止語 scan。 | ♻️ Sync 入口を Setup の手順カード列へ追加（§7）。新コピーは `copy.ts` に集中＋forbidden scan 通過。 |

**新規で起こすもの（既存に無い）**
- owner-level の**安定 routing 同一性**（`r15_owner` / `owner_ref`）と **epoch レジストリ**（`r15_owner_epoch`）。
- **device list**（`r15_device`：sig_pub＋enc_pub＋revoke）。
- **per-device ack の relay**（`r15_mesh_payload` ＋ `r15_mesh_ack`）。
- **content epoch keypair**（端末横断・private は信頼端末のみ・handoff/rotation で配布）。
- **端末横断 merge**（HLC 順序・origin 付き journal record V2）。
- Sync の UI とコピー（すべて新規 user-facing → §10 命名ゲート）。

---

## 2. schema（D1）— 提案・additive・🟥 STOP（適用しない）

> すべて **新規 server data フィールド**＝憲法境界。設計の確定のみ。`migrations/0015_*.sql` 番号は予約案。
> 既存テーブルは**一切触らない**（additive）。平文本文・private key は**どこにも置かない**。

### 2.1 `r15_owner` — owner の公開 routing 同一性（epoch 横断で安定）
```sql
CREATE TABLE r15_owner (
  owner_ref      TEXT PRIMARY KEY,          -- 安定・公開・不透明（16–32 hex）。peer はここ宛に送る
  handle         TEXT NOT NULL DEFAULT '',  -- passkey handle への任意束ね（KV AUTH）。handle-less も許容
  current_epoch  INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
```
`owner_ref` は **epoch rotation でも不変**。これにより「相手を指す名」が鍵の巻き直しで壊れない。

### 2.2 `r15_owner_epoch` — content epoch 公開鍵（暗号化宛先・private は絶対に置かない）
```sql
CREATE TABLE r15_owner_epoch (
  owner_ref   TEXT NOT NULL,
  epoch       INTEGER NOT NULL,
  epoch_pub   TEXT NOT NULL,               -- ECDH P-256 公開 JWK。isPublicEncJwk で 'd' 拒否
  active      INTEGER NOT NULL DEFAULT 1,   -- 1=現在の wrap 宛先、0=退役（新規 wrap には使わない）
  created_at  TEXT NOT NULL,
  PRIMARY KEY (owner_ref, epoch)
);
```
publish 時に `isPublicEncJwk` で **`d` を密輸したら publish 全体を弾く**（既存 invariant の踏襲）。

### 2.3 `r15_device` — device list（PX が持つのは公開鍵だけ）
```sql
CREATE TABLE r15_device (
  device_id   TEXT PRIMARY KEY,            -- 端末 mint・不透明
  owner_ref   TEXT NOT NULL,
  sig_pub     TEXT NOT NULL,               -- ECDSA P-256 公開：relay 要求の署名 ＋ device-add 認可
  enc_pub     TEXT NOT NULL,               -- ECDH P-256 公開：handoff / epoch 鍵配布の wrap 宛先
  label       TEXT NOT NULL DEFAULT '',    -- owner が付ける端末名（owner 表示のみ・peer 非開示）
  added_at    TEXT NOT NULL,
  added_by    TEXT NOT NULL DEFAULT '',    -- 認可した device_id（'' = 初端末＝passkey 経由）
  revoked_at  TEXT NOT NULL DEFAULT '',    -- '' = active
  last_epoch  INTEGER NOT NULL DEFAULT 0   -- この端末が受け取った最高 epoch（配布の帳尻）
);
CREATE INDEX idx_r15_device_owner ON r15_device(owner_ref);
```
**device 追加は passkey（owner identity）か既存端末の署名でゲート**（§3.4）。content private は触れない。

### 2.4 `r15_mesh_payload` — relay（一時配送 cache・正本でない）
```sql
CREATE TABLE r15_mesh_payload (
  payload_id   TEXT PRIMARY KEY,           -- 端末 mint（mesh_ / env_）
  audience_ref TEXT NOT NULL,              -- 宛先 owner_ref（self lane=自分／peer lane=相手）
  lane         TEXT NOT NULL CHECK (lane IN ('self','peer')),
  ptype        TEXT NOT NULL CHECK (ptype IN ('memory-delta','talk-msg','talk-mirror','handoff','epoch-key')),
  epoch        INTEGER NOT NULL,           -- wrap した epoch（device 宛 wrap のときは参照のみ）
  wrap_to      TEXT NOT NULL DEFAULT 'epoch' CHECK (wrap_to IN ('epoch','device')),
  to_device    TEXT NOT NULL DEFAULT '',   -- wrap_to='device' のとき宛先 device_id（handoff/epoch-key）
  eph_pub      TEXT NOT NULL,              -- ephemeral ECDH 公開（sealEnvelope）
  iv           TEXT NOT NULL,
  ciphertext   TEXT NOT NULL,              -- base64・chunk 可・PX は平文を一切持たない
  chunk_ix     INTEGER NOT NULL DEFAULT 0, -- 16KB 超の束（handoff）の分割
  chunk_of     INTEGER NOT NULL DEFAULT 1,
  state        TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held','expired')),
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_r15_mesh_aud ON r15_mesh_payload(audience_ref, state);
```

### 2.5 `r15_mesh_ack` — per-device 配送状態（内部・counterparty に出さない）
```sql
CREATE TABLE r15_mesh_ack (
  payload_id  TEXT NOT NULL,
  device_id   TEXT NOT NULL,
  acked_at    TEXT NOT NULL,
  PRIMARY KEY (payload_id, device_id)
);
```
**purge 規則**：`audience_ref` の **active 全端末**が ack 済み → ciphertext を物理 delete。
未達端末があれば held。TTL（§4）が backstop。**ack 行は purge 判定の内部資料**で、
peer（送り手）にも presence としても**一切出さない**（§4.5・§ goal の presence 禁止）。

### 2.6 平文・private key 不在の確認（受け入れ条件）
- `ciphertext` は base64 暗号文のみ。投函 API で平文形（JSON っぽさ）を弾く tripwire を踏襲。
- epoch / device は **公開鍵のみ**（`isPublicEncJwk` で `d` 拒否）。
- relay は **TTL＋全ACK purge**＝authoritative store でない。journal 正本はサーバに無い。

### 2.7 既存 `r15_envelope` / `r15_enc_key` の去就（STOP-C 裁定確定・非破壊）
✅ **裁定（2026-06-17）= 非破壊・bulk migrate なし・自然退役**：
- **legacy lane を残す**：既存 `r15_envelope`（flowing message/contact/standing note）は**移送しない**。
  そのまま legacy lane として稼働を続ける。**既存行に一切触れない**（破壊的 migration ゼロ）。
- **mesh は前向きのみ**：新規の Talk は `r15_mesh_payload`(lane=peer, ptype=talk-msg) に**だけ**載る。
  過去分の引っ越しはしない。
- **一定期間 dual-read**：受信側端末は **legacy（r15_envelope-fetch）と mesh（mesh/fetch）の両方を読む**。
  timeline は両 lane を merge して表示（§6・順序材料は §6.4 invariant の制約下）。
- **自然退役**：legacy lane は **TTL（14日）＋ack＋送信元の cutover** で時間とともに空になる。
  空になった時点で legacy fetch を別便で外す（bulk delete しない）。
- `r15_enc_key`（per-device pub）：legacy lane が生きている間は必要。mesh 全面化後に別便で退役。
- **standing note（kind=note）**：edge-scoped の据置状態。当面 `r15_envelope` に残置（Mesh 射程外）。
  epoch 化は将来便（本 HOW では据置で gate を満たす）。

---

## 3. 鍵設計（identity / device / content-epoch の導出・関係・rotation）

### 3.1 三鍵の役割（確定設計の固定）
```
owner identity (passkey, ECDSA P-256)   本人確認のみ。device-add / revoke のサーバ側ゲート。content 復号に使わない。
        │ gate（KV AUTH の handle⇄pub）
        ▼
device key（端末ごと・2鍵）              relay fetch 権限・要求署名（sig）／鍵配布の wrap 宛先（enc）／revoke 対象
   ├ device_sig : ECDSA P-256   … relay put/fetch/ack の署名、device-add 認可の署名
   └ device_enc : ECDH  P-256   … handoff 束・epoch private の wrap 宛先
        │ handoff / epoch 配布で受け取る
        ▼
owner content epoch keypair（ECDH P-256・端末横断で共有）
   ├ public  : routing/識別層（r15_owner_epoch.epoch_pub）。PX が持つが custody でない
   └ private : 信頼端末のみ（IndexedDB）。端末追加=handoff で渡す／端末除去=epoch を進めて巻き直す
```
WebCrypto の都合上 device key は **sig（ECDSA）と enc（ECDH）の2鍵**に分ける（同一 P-256 で両 usage は不可）。

### 3.2 導出と保管
- **owner identity**：既存 passkey 生成（端末の authenticator 内・export 不可）。サーバは handle⇄公開鍵のみ。
- **device key**：端末初期化で `device_sig`/`device_enc` を生成（`mintEncKeyPair` 流用＋ECDSA 生成を追加）。
  **private は IndexedDB のみ**（新 store `meshdevice`）。公開2鍵だけ device-add 時にサーバへ。
- **content epoch keypair**：最初の端末が `mintEncKeyPair()` で epoch=1 を生成。private は IndexedDB（新 store `meshepoch`、複数 epoch を保持＝過去の暗号文も読める）。public を `r15_owner_epoch` に publish。
- `owner_ref`：owner の安定公開 id。**epoch pub には縛らない**（rotation で壊れるため）。
  導出案 = 初回端末で乱数 mint（不透明 16–32 hex）し `r15_owner` に登録、以後不変。
  handle と束ねる場合は passkey assertion で `r15_owner.handle` に結ぶ（任意）。

> ✅ **STOP-A 裁定確定（2026-06-17）**：`owner_ref` を**新設**（既存非破壊）。`participantRef` を
> owner_ref に昇格**しない**・本番生データの **backfill しない**。三語の役割を固定する：
> - **`owner_ref`** … 身元 / **Mesh の正本**（peer はここ宛に送る・epoch 横断で不変）。
> - **`participantRef`** … **公開面の識別子**（pool/edge の既存 device-local ref・現状のまま据置）。
> - **`device_id`** … **個別端末**（device list の主キー・revoke 対象）。
>
> 結果：pool は participantRef のまま、Talk routing と Mesh だけが owner_ref を使う「二重持ち」になるが、
> **backfill 不要・既存行不触**。両者の写像（participantRef → owner_ref）は Phase A で additive に建てる
> （新 device-add 時に owner が自分の participantRef を owner_ref に紐づける owner-local 操作・サーバは公開射影のみ）。

### 3.3 暗号化の宛先（誰の鍵で包むか）
- **Memory delta（self lane）**：自分の **current epoch_pub** に `sealEnvelope`（self 宛）。
- **Talk message（peer lane）**：相手 `owner_ref` の **current epoch_pub** に `sealEnvelope`。
  （確定設計の「content key を {相手 owner pub, 自分 owner pub} に包む」を、message ごと ephemeral ECDH＝
  既存 envelope の形で実現。self mirror（talk-mirror）は自分の epoch_pub にも包んで他端末へ。）
- **handoff 束 / epoch private 配布**：宛先**端末の `device_enc` pub** に `sealEnvelope`（wrap_to='device'）。

### 3.4 device 追加（device-add）の認可
新端末を owner の集合へ入れる瞬間は、**他人を混ぜない**ためのゲートが要る。二経路：
1. **passkey 経由（初端末・または信頼端末ゼロからの再構築）**：passkey assertion（既存 `/api/auth/verify`）で
   本人確認 → サーバが当該 handle/owner_ref 下に device_pub 登録を許可。
2. **既存端末の署名経由（通常の増設）**：既存信頼端末が「add device {new sig_pub,new enc_pub}」を
   `device_sig` で署名 → サーバは署名を検証して登録。`added_by` に認可端末を記録。

いずれも **content private はサーバを通らない**。サーバは「この公開鍵を持つ端末を owner 集合に入れてよい」
という**認可の事実**だけを受ける。

### 3.5 epoch rotation 手順（端末除去・定期巻き直し）
```
1. revoke：owner（信頼端末・passkey gate）が対象 device を revoked_at セット
2. relay 遮断：サーバは revoked 端末の sig_pub からの fetch/put/ack を 401（fail-closed）
3. purge：その owner_ref 宛の未配送 payload のうち、残存端末が全 ack 済みのものを delete。
   未達分は held のまま（残存端末がいずれ ack→purge）。revoked 端末宛だけの payload は即 purge
4. rotate：残存端末のいずれかが新 epoch keypair（epoch=n+1）を mint。
   r15_owner.current_epoch ＝ n+1、r15_owner_epoch に epoch_pub(n+1, active=1)、旧 epoch を active=0
5. 配布：新 epoch private を **残存各端末の device_enc pub に wrap**（ptype=epoch-key, wrap_to=device）して relay 投函。
   各端末が fetch→unwrap→install→ack→purge
6. 以後：新 epoch_pub で wrap。旧 epoch の暗号文は**残存端末が旧 epoch private を保持しているので読める**
   （前方遮断は epoch 境界で足りる＝per-message forward secrecy は基本要件にしない＝確定設計どおり）
```
**revoked 端末の手元に既にある過去は端末内に残る**（remote wipe しない・できない）。UI はそれを**正直**に出す（§7・§ 安全表現）。

### 3.6 復旧の escape hatch（信頼端末ゼロ）
- 既存端末が全滅し、handoff 元が無いとき、**私的履歴はサーバから戻せない**（relay は cache・正本でない）。
- 唯一の戻し路は owner が**事前に作った封緘 backup**（`sealPrivateKey` で epoch private＋journal を passphrase 封緘し、
  owner 自身が端末外に保管）。これを新端末で `openSealedKey`→install→以後 relay 合流。
- backup 不在なら **正直に「私的記憶は戻りません」**を出す（沈黙しない・嘘の希望を出さない）。

---

## 4. relay protocol（put / fetch / ack / purge・TTL・per-device 状態）

### 4.1 認証
relay の各要求は **device_sig 署名**を載せる（body のハッシュ＋timestamp を署名）。
サーバは `r15_device` の sig_pub で検証し、**revoked なら 401（fail-closed）**。
（既存 `_middleware` の Basic 免除と同じ「ぴったり一致＋自前 fail-closed」方式を踏襲。）

### 4.2 put（投函）`POST /api/mesh/put`
- 入力：`{audience_ref, lane, ptype, epoch, wrap_to, to_device?, eph_pub, iv, ciphertext, chunk_ix, chunk_of}`（device_sig 署名）
- 検証：ciphertext が**平文形でない**（tripwire）／size ≤ 16KB/chunk／audience_ref が実在／lane=self なら audience=自分。
- 書込：`r15_mesh_payload` に held。
- **送り手側状態は own-side のみ**（送信中→送った）。サーバは届いた/既読を返さない。

### 4.3 fetch（取得）`POST /api/mesh/fetch`
- 入力：`{since_cursor?}`（device_sig 署名）。device の owner_ref を sig から解決。
- 返却：`audience_ref=自分の owner_ref` ＋ `wrap_to='epoch'`、または `wrap_to='device' AND to_device=自分` の held を返す。
  **counterparty の ack 状況・端末数・最終取得は一切返さない。**
- read-time に TTL 適用（§4.6）。

### 4.4 ack（受領）`POST /api/mesh/ack`
- 入力：`{payload_ids[]}`（device_sig 署名）。
- 書込：`r15_mesh_ack` に (payload_id, 自 device_id) を挿入。
- **全 active 端末 ack 達成で payload を物理 delete**（§4.5）。単一 ack では消さない（多端末取り逃し防止）。

### 4.5 purge（掃き取り）— 全ACK削除と即時 purge
```sql
-- 全 active 端末が ack した payload を delete（read-time/ack-time に実行・cron なし）
DELETE FROM r15_mesh_payload
 WHERE payload_id IN (
   SELECT p.payload_id FROM r15_mesh_payload p
   WHERE p.audience_ref = :owner
     AND (SELECT COUNT(*) FROM r15_device d
            WHERE d.owner_ref = :owner AND d.revoked_at = '') 
       = (SELECT COUNT(*) FROM r15_mesh_ack a
            JOIN r15_device d2 ON d2.device_id = a.device_id
           WHERE a.payload_id = p.payload_id AND d2.revoked_at = '')
 );
DELETE FROM r15_mesh_ack WHERE payload_id NOT IN (SELECT payload_id FROM r15_mesh_payload);
```
- **revoke 時**：対象端末だけ宛の payload（wrap_to=device,to_device=revoked）を即 delete。
- **owner 全消去**：その owner_ref を audience とする payload を**実消去**（exit-safe）。

### 4.6 TTL
- 既定 **14日**（`MESH_TTL_DAYS=14`・既存 envelope と同値）。handoff 束は短め（例 **72時間**）— 受け渡しは即時的。
- read-time に `held & created_at < cutoff` → `state='expired', ciphertext=''`（tombstone）→ 後続で hard delete。
- relay は cache であって**蓄積場でない**ことを TTL で機械的に保証（numbers §gate）。

### 4.7 per-device 配送状態（不変条件・STOP-E 裁定確定）
- 状態は `r15_mesh_ack` に**端末ごと**＝最初の1台 ack で他端末が取り逃さない。
- この状態は **purge 判定の内部資料**。fetch/put の応答にも、peer にも、UI の presence にも**出さない**。
- ✅ **出してよい（自分側の事実のみ）**：`未送信` / `送信中` / `送った`（＝relay に置いた事実）/
  `送れませんでした` / `この端末に同期済み`。
- ❌ **禁止（presence・相手の状態）**：`相手に届きました` / `相手が読みました` / `相手が入力中` /
  `相手がオンライン` / `相手の端末に同期済み`。
- 「送った」の意味の床：**relay に置いた**という自分側の事実であって、相手が受け取った保証ではない
  （「届いた」とは言わない）。

---

## 5. handoff protocol（QR ＋ 承認 ＋ E2EE 束）

新端末に過去を渡すのは **PX 経由でない**（サーバは正本でない）。既存信頼端末から E2EE で束を渡す。

### 5.1 束の中身
```
HandoffBundleV1 = {
  ownerRef,
  epochs: [{epoch, priv(JWK)} …],      // 現行＋過去 epoch の private（過去暗号文も読めるように）
  memoryJournal: MemJournalRecordV2[],  // append-only 全件スナップショット（§6）
  talkTranscript: TalkEntryV1[],        // 全 thread
  // 含めない：下書き・生 AI 会話・API キー（§ 制約）。API キーは別 opt-in（§7.4）
}
```

### 5.2 手順（port-once）
```
1. 新端末：device_sig/device_enc keypair を mint。device_enc pub ＋ 短い pairing nonce を QR に焼く
2. 既存端末：QR を読む（または手入力の短コード）。owner に承認を出す（「この端末をつなぐ？」）
3. 既存端末：device-add を device_sig で署名し /api/mesh/device に登録（§3.4 経路2）
4. 既存端末：HandoffBundle を作り、新端末 device_enc pub に sealEnvelope（16KB 超は chunk 分割）
   → ptype=handoff, wrap_to=device, to_device=new で relay 投函
5. 新端末：fetch→unwrap（device_enc priv）→ chunk 結合→ install
   （epoch priv を meshepoch へ・journal を mergeForeign で取り込み・talk を union）→ ack→purge
6. 以後：新端末は current epoch を持つので relay で自然に届く
```
- **pairing nonce** は中間者対策（QR を撮った端末だけが承認に進める短命トークン）。
- 物理的に離れた端末でも、束は relay（72h TTL・全 ack で即 purge）を**配送 cache として一回だけ**通す＝正本化しない。
- **信頼端末ゼロなら handoff 元が無い** → §3.6（封緘 backup か、正直に「戻らない」）。

---

## 6. merge（append-only journal の差分・union・dedup・時刻順・忘却）

### 6.1 問題：`seq` は端末内ローカル
既存 journal の `seq` は端末内で単調増加だが、**2端末の seq は衝突する**（両方 1,2,3…）。
端末横断の決定的順序には `seq` を使えない。

### 6.2 解：record V2（origin ＋ HLC）— 私的層の拡張（憲法外・但し journal 契約変更＝pin 更新要）
```ts
type MemJournalRecordV2 = MemJournalRecordV1 & {
  origin: string;   // 生成端末の device_id（tiebreak）
  hlc: string;      // hybrid logical clock "〈wallMillis〉:〈counter〉:〈deviceId〉"（単調・skew 耐性）
};
```
- **ローカル append**：従来どおり `seq`（端末内挿入順・配列添字）＋ `hlc` を刻む。
- **横断順序**：merge とすべての fold は **`hlc` 昇順**で評価（`seq` は端末内の物理順のみに降格）。
- HLC は wall clock＋counter＋deviceId で全順序。`px-guard` の dot-sort 遮断に触れぬよう、
  比較は**専用 comparator（HLC 文字列の辞書式）**で行い ranking 文脈と混ぜない（journal の既存 orderBySeq と同じ原理＝位置で並べる思想を踏襲しつつ、横断は HLC キー）。

### 6.3 取り込み `mergeForeign(records)`（新メソッド）
```
1. id dedup：recordId 既知ならスキップ（同一 record は内容も同一＝冪等）
2. 取り込み：未知 record を recordId/createdAt/hlc/origin verbatim で append（local seq だけ新規採番）
   ※既存 restore() の verbatim 思想を踏襲。restore は backup 用、mergeForeign は横断用に分離
3. 順序：list は hlc 昇順で返す（orderByHlc）
```

### 6.4 fold（順序非依存で収束）＋ 🟥 新 invariant（判定しない柱）
既存 fold をそのまま使える（評価順を hlc に揃えるだけ）：
- **忘却 = forget event**（tombstone・物理削除しない）。`foldForgottenIds` が最新 event=forget を集約。
- **訂正 = supersede chain**。`foldSupersededIds` が非 head を除外。
- **surface/forget の競合**：同一 targetRef に複数端末から surface/forget が来たら **hlc 最新が勝つ**。
- 収束保証：2端末が同じ record 集合に達すれば fold 結果は**同一**（CRDT 的・順序非依存の union＋last-writer-by-hlc）。

> ✅ **新 invariant（裁定確定 2026-06-17・「判定しない」柱の延長）**：
> dual-read（legacy＋mesh）と横断 merge の **時刻 / HLC / seq の順序材料は、timeline 収束専用**。
> **候補の品質・重要度・頻度・相性・順位** には**一切流入させない**。
> - HLC/時刻は「どちらが後か」を決める**収束の道具**であって、「どちらが良いか・重要か」の**判定の道具にしない**。
> - 順序材料は journal/talk の表示順（timeline）にだけ届く。pool 投影・候補生成・proposal・matching・ranking
>   のいかなる経路にも**到達しない**（コードの依存方向で断つ）。
> - **断言（ws-smoke / 静的）**：Sync/Mesh/merge 層は candidate/pool/ranking/matching モジュールを import せず、
>   順序材料（hlc/at/seq）がそれらの経路へ渡らないことを test で固定する（§9-9）。
>   `px-guard` の dot-sort 遮断と同系譜＝**比較で並べず位置（hlc キー）で並べる**。

### 6.5 delta の取り口（relay に載せる単位）
- 各端末は「自分が他端末へまだ流していない record」を **per-audience cursor**（新 store `meshcursor`）で管理。
- 新 record 群を `memory-delta` payload（self lane・epoch_pub wrap）として put。
- 他端末は fetch→decrypt→`mergeForeign`→ack。Talk は §6.6。

### 6.6 Talk の merge（journal より単純）
- `talk` store は entryId キー・`at` 時刻順。受信は env id で idempotent、送信は端末 mint で安定。
- 送信控えは `talk-mirror`（self lane）で他端末へ。**merge = entryId union ＋ at 順**（fold 不要）。
- keychange/expired の表示語は表示層が持つ（text="" のまま）＝既存設計踏襲。

---

## 7. UI 配線（語彙 Antenna/Finds/Talk/Memory/Setup/Run/Trust 維持）

### 7.1 入口：Setup の手順カードに「Sync」を追加
- 位置：`app/meet/start/page.tsx` の `m-doorsteps` に新カード（`#step-sync`）。`#name` の近傍。
- 見出し：**Sync**（rail には増やさない＝道具は Antenna/Finds/Talk のまま。Sync は Setup のセクション）。
- 中身：「**端末をつなぐ**」ボタン → QR 表示（既存端末側）／QR 読取（新端末側）。

### 7.2 接続済みの端末＋外す
- **接続済みの端末**一覧：label・追加日・「**この端末**」表示。各行に「**外す**」（revoke）。
- 「外す」押下 → 確認 → revoke→（§3.5）epoch rotate。
- **正直文言**（確定コピー使用）：外した端末の手元に残る過去は消えない旨を**明示**
  （「**外した端末から過去も消える**」は**言わない**＝§安全表現）。

### 7.3 同期状態（自分側の事実のみ・STOP-E 裁定確定）
- own-side のみ（確定）：**未送信／送信中／送った（＝relay に置いた事実）／送れませんでした／
  この端末に同期済み**。（復号失敗は own-side のエラーとして「復号できませんでした」。）
- **禁止（presence・相手の状態）**：相手に届きました／相手が読みました／相手が入力中／相手がオンライン／
  相手の端末に同期済み。これらは UI・API・schema のどこにも出さない（presence 永続禁止）。
- 一覧コピー「**同期／同期しない**」（確定）で per-端末の persistence opt-in を表現。
  ※「この端末の同期を止める」の確定文言は GPT 版採用（§12・要 paste）。

### 7.4 API キー移行 opt-in（明示のみ）
- 既定 **同期しない**。端末追加フローの中に独立トグル「この端末に API キーも渡す（任意）」。
- opt-in 時のみ、API キーを handoff 束とは**別の明示 payload**で渡す（束に紛れ込ませない）。
- 下書き・生 AI 会話は**同期しない**（束にも入れない・§制約）。

### 7.5 コピー（`lib/meet/copy.ts` に集中・forbidden scan 通過）
- 確定済み（指示書が祝福＝命名ゲート通過）：`Sync`／`つなぐ`／`端末をつなぐ`／`接続済みの端末`／`外す`／
  `同期`／`同期しない`／revoke の正直文言。→ そのまま実装してよい（勝手に整えない）。
- **未確定（指示書が文言を与えていない）→ §10 命名 STOP**：QR 画面の手引き、handoff 承認の問い、
  「復号できませんでした」等のエラー文、「この端末に残る過去」の正直一文の**確定文言**。候補のみ出す。

---

## 8. build 段取り（背骨＝身元/端末管理 → handoff → short relay。再配列は CC 裁量）

| Phase | 内容 | server 触る？ | gate |
|---|---|---|---|
| **A. 身元・端末レジストリ** | `r15_owner`/`r15_owner_epoch`/`r15_device`＋device-add(passkey/署名)＋owner_ref 導出。content まだ無し | 🟥 新 schema | STOP-A（owner_ref 新設 vs 昇格）裁定後 |
| **B. content epoch ＋ handoff(port-once)** | epoch keypair 生成・publish・QR・E2EE 束・新端末 install＋merge | relay put/fetch（device 宛） | crypto round-trip green |
| **C. short relay（self lane）** | Memory journal delta 同期・`mergeForeign`・HLC・meshcursor | mesh put/fetch/ack/purge | 多端末取り逃しゼロ test |
| **D. Talk を Mesh へ** | peer Talk を epoch_pub wrap・per-device ack・talk-mirror・`r15_envelope` 移送 | 🟧 既存 message 移送（⛔ backfill 裁定） | presence 漏れゼロ test |
| **E. revoke ＋ epoch rotation** | revoke→relay 遮断→purge→rotate→配布→future wrap・正直 UI | revoke endpoint | rotation/過去残存 test |
| 横断 | UI（Sync 入口・一覧・外す・同期状態・APIキー opt-in）／コピー／test／numbers 検証 | — | 全 gate |

各 Phase の本番反映は**しない**（Phase 0.5 は HOW まで）。実装着手自体が STOP #0＋四者レビュー後。

---

## 9. test 計画

1. **crypto 正当性**：`sealEnvelope/openEnvelope` epoch_pub round-trip。`sealPrivateKey/openSealedKey` 封緘 round-trip
   ＋誤 passphrase throw。`isPublicEncJwk` が `d` 付き JWK を全経路で拒否（publish/handoff/epoch-key）。
2. **複数端末配送**：3端末・1台 ack 後も残2台が同じ payload を取得できる（取り逃しゼロ）。全 ack で purge。
3. **revoke / rotation**：revoked 端末の sig は relay 401。rotate 後、新規 payload は新 epoch_pub。
   **新 epoch しか持たぬ端末は旧 epoch 暗号文を復号できない**（前方遮断）。残存端末は旧 priv 保持で過去読める。
   revoked 端末の手元 IndexedDB の過去は残る（remote wipe しない＝UI 文言と一致）。
4. **handoff 履歴**：新端末が**サーバ由来でなく**束経由で全 Memory/Talk を得る。
   断言 test：**サーバ（relay/D1）に平文 journal・private key が一度も存在しない**（投函物は ciphertext のみ）。
5. **無 presence**：fetch/put/ack の応答・port・UI のどこにも、相手の端末数・ack・最終閲覧・既読が出ない
   （スナップショット test ＋ 応答 schema assert）。送り手は own-side 事実のみ。
6. **append-only merge**：2端末で分岐した journal（互いに知らない record＋競合する forget/supersede）を
   双方向 merge → **両端末の fold 結果が完全一致**（id dedup・hlc 順・tombstone 保存）。冪等再投入で不変。
9. **判定しない柱（順序材料の隔離）**：Sync/Mesh/merge 層が candidate/pool/ranking/matching を import せず、
   順序材料（hlc/at/seq）がそれらの経路へ到達しない（静的 import グラフ ＋ ws-smoke で断言・§6.4 invariant）。
   dual-read の legacy＋mesh の merge は timeline 表示にだけ効き、候補生成へ波及しない。
7. **numbers**：owner あたりサーバ恒久行 = `r15_owner`(1)＋`r15_owner_epoch`(O(epoch))＋`r15_device`(O(端末))
   のみ。**私的記憶量に比例しない**（journal はサーバ不在）。relay 行は TTL＋全ACK で有界。
   ＝無料 owner の記憶量に比例する恒久コストが乗らない。
8. **exit-safe**：owner 全消去で当該 audience の relay payload が**実消去**される（§4.5）。

---

## 10. 受け入れゲート（HOW）チェック

| ゲート | 本 HOW の充足 |
|---|---|
| schema に平文本文・private key 無し | ✅ §2.6（ciphertext のみ・公開鍵のみ・`d` 拒否） |
| relay が恒久 store でない | ✅ §4.6 TTL＋§4.5 全ACK purge＋owner 全消去 |
| 多端末取り逃しゼロ＋recipient に状態漏れず | ✅ §2.5 per-device ack（内部）＋§4.7 非開示 |
| 新端末の過去が handoff 経路（PX 由来でない） | ✅ §5（束は端末→端末・relay は cache） |
| revoke ＝ epoch rotation＋未来遮断＋過去は端末内＋正直 UI | ✅ §3.5・§7.2 |
| numbers：記憶量比例の恒久コスト無し | ✅ §9-7 |
| 命名（内部=Device Mesh／表層=Sync・端末をつなぐ）確定 | ✅ 確定分は §7.5。**未確定文言は下記 STOP** |

---

## 11. STOP の解決状況（2026-06-17 裁定後）

| STOP | 状態 |
|---|---|
| **STOP-A**（owner_ref 新設 vs 昇格） | ✅ **解決＝新設**（昇格しない・backfill しない・三語固定）。§3.2 |
| **STOP-C**（legacy 去就） | ✅ **解決＝非破壊 dual-read・自然退役**。§2.7 |
| **STOP-E**（自分側の事実） | ✅ **解決**（own-side 5語のみ・presence 禁止）。§4.7・§7.3 |
| **STOP-D**（命名） | ✅ 確定コピー採用（§12）。**ただし下記 5本は GPT 版 paste 待ち** |
| 新 invariant（順序材料） | ✅ §6.4 に焼いた（判定しない柱の延長） |

**残る STOP（crypto/server 実装の前提・まだ閉じていない）**
- **STOP-B（憲法境界＝新規 server data・Hiroto STOP #0）**：`r15_owner`/`r15_owner_epoch`/`r15_device`/
  `r15_mesh_payload`/`r15_mesh_ack` の新設（§2 全体）＋ edge_note 追補。additive だがサーバ保持データの新設＝境界。
- **GPT crypto 5点 verdict**：rotation 前方遮断 / HLC+fold 収束 / handoff 信頼起点 MITM / 72h 一時滞留の許容 /
  mesh_payload purge 実効。
- **STOP-D 残（命名・CC が paste 待ち）**：GPT 版でそのまま採用とされた 5本の本文 ——
  **QR 手引き / 接続完了 / handoff 失敗 / 既存端末なし / 「この端末の同期を止める」**。
  本書・UI 足場には未反映（CC が GPT 版テキストを受領次第 §12 と SyncSection に流し込む）。

> 実装（crypto/server）は GPT 5点 verdict ＋ Hiroto STOP #0 が開くまで入らない。
> 緑作業（docs 反映・非 crypto UI 足場）はここまで。

---

## 12. 確定コピー（STOP-D・2026-06-17 verbatim）

> 表層は確定。`lib/meet/copy.ts` の `MEET.sync` に集中・forbidden scan 通過済み。
> **動的部分**（端末名・時刻）は実行時に差し込む。場所は精密に出さず「近くの端末」＝近接確認だけを示す。

### 承認の問い（既存端末に出る・追加対象を名指し＋近接/時刻＝本物確認）
```
新しい端末を追加しますか？

MacBook
近くの端末 ・ 今日 21:34

追加すると、この MacBook で Antenna・Talk・Memory を使えるようになります。

同期するもの:  Antenna / Talk / Memory / 呼び名 / ひとこと
同期しないもの: APIキー / 生のAI会話 / 未確認の下書き

[追加する] [やめる]

身に覚えのない端末なら、追加しないでください。
（端末名・時刻は動的。場所は精密に出さず、近接確認だけを示す）
```

### 端末を外す（対象で二態）
```
〔一覧から別端末〕
iPhone を外しますか？
外した端末は、これから届くものを読めません。すでにその端末にあった会話は、その端末の中に残ります（PXは消せません）。
[外す] [やめる]

〔今いる端末〕
この端末を外しますか？
この端末は、これから届くものを読めなくなります。すでにこの端末にある会話は、この端末の中に残ります（PXは消せません）。
[外す] [やめる]
```

### 全消去（「同期を止める」とは別操作・着地は Memory/Trust）
```
このPXのMemoryとTalkを消しますか？

この端末から Memory と Talk を消し、接続済みの自分の端末にも削除を伝えます。まだ届いていない分も削除します。

相手の端末にある会話は消えません。相手のPXには触れません。

公開済みの Antenna・呼び名・ひとことは、別に取り下げてください。

[すべて消す] [やめる]
```

### 一覧・入口・状態（確定トークン）
- セクション見出し：`Sync`／接続ボタン：`端末をつなぐ`／一覧見出し：`接続済みの端末`／現端末印：`この端末`
- per-端末トグル：`同期` / `同期しない`
- 自分側の状態（§4.7）：`未送信` / `送信中` / `送った` / `送れませんでした` / `この端末に同期済み`

### GPT 版そのまま採用（**本文 paste 待ち・未反映**）
- QR 手引き／接続完了／handoff 失敗／既存端末なし／「この端末の同期を止める」
  → 受領次第 `MEET.sync` と SyncSection に流し込む（現状は scaffold で該当箇所を保留）。
