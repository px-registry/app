# PX Device Mesh — 本番 cutover 準備設計（Phase 0.5・草案 v0.1・docs-only）

> **これは設計（HOW）だけ。実装・本番適用はしない。** 本番 D1 `--remote` migration／deploy／main 直 push／
> production data 接続には**入らない**。本書は **本番別 Go の前提資料**。確定は **Hiroto ＋ Claude ＋ GPT 一読後**。
> 由来: Device Mesh A→B→C→C.1→UI便→live render が local/dev で閉じた（docs/r2/device-mesh-how-v0.3.md）。
>
> **一行**: 「いつ・何を適用し・何を止めれば戻せ・どの段で Hiroto Go / 一読が要るか」を一意にする。
> **不可逆を一括で踏まない** — 0015 apply / deploy / cutover 起動を**三つの Go**に割り、各段に rollback を持つ。

---

## A. 本番 D1 migration 境界（0015）

`migrations/0015_device_mesh.sql`。**additive-only**（CREATE TABLE / CREATE INDEX のみ・既存表に ALTER/DROP なし）。
本番 `px-app-board` への `--remote` 適用は **Go1（別 Go）**。それまで CLAUDE.md の規律どおり適用しない。

### A.1 5 表（exact・additive）
```sql
-- owner の公開 routing 同一性（epoch 横断で安定）
CREATE TABLE r15_owner (
  owner_ref TEXT PRIMARY KEY, handle TEXT NOT NULL DEFAULT '', participant_ref TEXT NOT NULL DEFAULT '',
  current_epoch INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL );
-- content epoch 公開鍵（暗号化宛先・private は絶対に置かない）
CREATE TABLE r15_owner_epoch (
  owner_ref TEXT NOT NULL, epoch INTEGER NOT NULL, epoch_pub TEXT NOT NULL,  -- ECDH P-256 公開 JWK（'d' 拒否）
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, PRIMARY KEY (owner_ref, epoch) );
-- device list（公開鍵だけ・revoke 対象）
CREATE TABLE r15_device (
  device_id TEXT PRIMARY KEY, owner_ref TEXT NOT NULL, sig_pub TEXT NOT NULL, enc_pub TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '', added_at TEXT NOT NULL, added_by TEXT NOT NULL DEFAULT '',
  revoked_at TEXT NOT NULL DEFAULT '', last_epoch INTEGER NOT NULL DEFAULT 0 );
CREATE INDEX idx_r15_device_owner ON r15_device (owner_ref);
-- relay payload（一時配送 cache・正本でない・body は暗号文のみ・TTL＋全ACK purge）
CREATE TABLE r15_mesh_payload (
  payload_id TEXT PRIMARY KEY, audience_ref TEXT NOT NULL, lane TEXT NOT NULL CHECK (lane IN ('self','peer')),
  ptype TEXT NOT NULL CHECK (ptype IN ('memory-delta','talk-mirror','talk-msg','handoff','epoch-key')),
  epoch INTEGER NOT NULL, wrap_to TEXT NOT NULL DEFAULT 'epoch' CHECK (wrap_to IN ('epoch','device')),
  to_device TEXT NOT NULL DEFAULT '', eph_pub TEXT NOT NULL, iv TEXT NOT NULL, ciphertext TEXT NOT NULL,
  chunk_ix INTEGER NOT NULL DEFAULT 0, chunk_of INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held','expired')),
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL );
CREATE INDEX idx_r15_mesh_aud ON r15_mesh_payload (audience_ref, state);
CREATE INDEX idx_r15_mesh_exp ON r15_mesh_payload (expires_at);
CREATE INDEX idx_r15_mesh_todev ON r15_mesh_payload (to_device);
-- per-device 配送状態（内部資料・counterparty/presence 非開示）
CREATE TABLE r15_mesh_ack ( payload_id TEXT NOT NULL, device_id TEXT NOT NULL, acked_at TEXT NOT NULL,
  PRIMARY KEY (payload_id, device_id) );
```

### A.2 additive-only の証明（schema diff）
- `0015_device_mesh.sql` は **CREATE TABLE × 5 ＋ CREATE INDEX × 4 のみ**。`ALTER`/`DROP`/`UPDATE`/`DELETE` を含まない。
- 既存表（board_records / r15_pool_item / r15_edge / r15_envelope / r15_enc_key 等）に**一切触れない**。
- 機械的裏打ち: `lib/board-template/template-gates.test.ts` impl-9（migration 一覧の pin に 0015 を追加）＋
  impl-10（migration に board-template/draft/board-state 表を作らない・破壊的変更なし）。
- 適用前確認: `npx wrangler d1 migrations list px-app-board --remote` で **0015 のみ pending**を目視。
- 列の不変: `r15_owner_epoch.epoch_pub` は **public JWK のみ**（publish 時に `isPublicEncJwk` で `d` 密輸を 400 拒否）。
  `r15_mesh_payload.ciphertext` は **暗号文のみ**（put で平文形を弾く・PX は平文を持たない）。
  `r15_mesh_ack` は **purge 判定の内部資料**（fetch/応答・UI・presence に出さない）。`expires_at` 列＝TTL 正本。

---

## B. 段階 Go 構造（一括で進めない）

### Go1 — 0015 apply（5 表を作る・休眠）
- 操作: `npx wrangler d1 migrations apply px-app-board --remote`（本番 D1）。**🔴 本番 `--remote`＝Hiroto Go 必須。**
- この段階で **誰も書かない**（endpoint 未 deploy or mesh-write OFF）。5 表は空・休眠。
- **要件**: 適用前に dev/local/preview で 0015 green（既済）＋ §D enforcement green ＋ Claude/GPT が 0015 SQL を一読。
- **rollback（Go1 直後・本番書き込みが一切無い場合のみ）**: `DROP TABLE r15_mesh_ack; … r15_owner;`（5 表 DROP）。
  ※**本番データが入った後は DROP を rollback と呼ばない**（§G）。

### Go2 — deploy（endpoint/UI は在る・mesh 書き込みは OFF/opt-in）
- 操作: Device Mesh を本番 Pages（px-r15・production branch=`stage-r15-five-test`）へ deploy。
  コードは現在 `stage-r2-complete`。**prod branch への載せ替え（cherry-pick/merge）＋ deploy ＝ 🔴 Hiroto Go＋full review。**
- **mesh 書き込みは OFF**（フラグ `MESH_WRITE`＝既定 off／または tester allowlist 限定）。relay put/handoff/register は
  フラグ off の間 **403/no-op**。legacy lane は不変で稼働。
- **rollback**: Cloudflare ダッシュボードで**直前 deployment へ rollback**（rollback 座標は §F）。`MESH_WRITE` OFF を確認。
  legacy lane 維持（mesh は休眠のまま）。
- secrets: `AUTH_SECRET` が production に設定済みであること（§D）。`ALLOW_DEV_SECRET` は **置かない**。

### Go3 — cutover 起動（mesh 書き込み ON・最初は 5 人限定）
- 操作: `MESH_WRITE` を **5 人テスターの owner_ref allowlist 限定**で ON。新規 Talk/Memory delta が mesh lane に乗り始める。
- **🔴 Hiroto Go ＋ full review（Claude＋GPT）後**にだけ flip。
- **rollback（本番データ後の正本・§G）**: `MESH_WRITE` OFF → **legacy-only 書き込みへ戻す** → **dual-read は維持** →
  **mesh に入った既存データは消さず、読めるものとして残す** → **データ損失を起こさない**。

---

## C. dual-read cutover 状態機械

```
[legacy-only]    全書き込み legacy（r15_envelope）。mesh 休眠。              ← Go2 まで
    │ Go3 flip（allowlist 内）
    ▼
[dual-write 前向き / dual-read]
    - 新規 Talk message / Memory delta は **mesh lane**（talk-msg / memory-delta）へ。
    - 既存 legacy は **legacy lane に残す**（移送しない・**bulk migrate なし**）。
    - 受信は **legacy（envelope-fetch）＋ mesh（relay/fetch）の両方を読む**＝dual-read。
      timeline は同一 talk store ＋ mergeTalkTimeline（entryId dedup・(at,entryId) 決定的順・note-out 除外）。
    - **edge_note / standing note は Phase C/D の別裁定まで legacy**（mesh に混ぜない）。
    - mesh lane に乗るのは **Memory delta / Talk msg（＋talk-mirror）だけ**。
    │ dual-read 期間（観察）
    ▼
[自然退役]
    - legacy lane は **TTL（14日）＋ack＋送信元 cutover** で時間とともに空になる。
    - 空になった lane の legacy fetch は**別便で外す**（bulk delete しない）。
```
- **rollback は「mesh 書き込み停止 ＋ dual-read 維持」**（§G）。legacy へ戻しても mesh 既存は読めるまま。

---

## D. 本番 invariant enforcement（checklist）

cutover の各 Go 前に green を要求する。

- [ ] **本番相当 smoke は実 `AUTH_SECRET`** で回す（DEV_SECRET に落ちない＝fail-closed・`lib/webauthn/auth-secret.ts`）。
- [ ] **`ALLOW_DEV_SECRET` を preview / production env に置かない**（local `.dev.vars` のみ）。不在で session 偽造不可。
- [ ] private-smuggle（epoch_pub に `d`）→ **400**。
- [ ] sig-tamper（改竄署名）→ **401**。
- [ ] revoke → **epoch rotate**（inactive→fetch停止→対象宛 purge→新 epoch active）。
- [ ] revoked device の fetch/ack/handoff → **401**。
- [ ] stale epoch put → **409**（古い宛先の新規暗号文を乗せない）。
- [ ] **presence 非開示**（届いた/読んだ/入力中/オンライン/相手端末同期 を出さない）。
- [ ] **ack / delivery state 非開示**（counterparty/UI/presence に出さない・内部資料）。
- [ ] **M-14 / 順序材料の隔離**（hlc/merge/sync/timeline が ranking/candidate/matching/pool を import しない）。
- [ ] **ranking / matching / candidate quality に順序材料（hlc/at/seq）が流入しない**（import 隔離＋dot-sort 遮断）。
- 既存の証拠: backend smoke 14/14・handoff 12/12・relay 23/23・dual-read live 15/15・unit DR/HLC/AS・tsc/test/build/ws-smoke。
  cutover 前に **これらを実 `AUTH_SECRET` の preview（px-r15-preview 等）で再走**する。

---

## E. テスター限定 cutover（5 人）

最初の本番 mesh 起動は **5 人 owner_ref allowlist 限定**（Go3）。

確認項目（5 人の実機・Hiroto のブラウザ＝実鍵／合鍵は端末）:
- [ ] **round-trip**（handoff で新端末が過去を受け取る）
- [ ] **dual-read**（legacy＋mesh が一本の Talk thread）
- [ ] **exit-safe**（全消去で自分宛 relay payload が実消去・相手には触れない）
- [ ] **handoff**（QR テキスト→記述子確認→承認後にだけ封緘＋put＝confirm-gated）
- [ ] **Sync**（接続済みの端末一覧・外す・同期を止める）
- [ ] **Talk**（mesh talk が受信側に出る・二重なし）
- [ ] **Memory delta**（端末間で記憶が揃う）
- [ ] **purge**（全 active ACK で消える・1 台では消えない・revoke 後も完走）
- [ ] **no presence**（相手の状態が一切出ない）
- [ ] **no plaintext / no private key**（server に平文本文・private 鍵が無い＝暗号文/公開鍵のみ）

**広げる判断点**: 上記 10 項目が 5 人で green ＋ 観察期間に気配（presence 漏れ・誤配送・取り逃し）ゼロ ＋
relay の恒久コストが記憶量に比例しない（numbers）ことを確認 → **Hiroto 裁定で allowlist 解除（全テスター）**。
それまで allowlist 外は legacy-only（mesh 書き込み OFF）。

---

## F. 赤の地図（いつ・どの Go で踏むか）

| 赤の操作 | どの Go | ゲート |
|---|---|---|
| 本番 D1 `--remote`（0015 apply） | **Go1** | 🔴 Hiroto Go ＋ Claude/GPT が 0015 SQL 一読 ＋ §D green |
| 本番 deploy（px-r15） | **Go2** | 🔴 Hiroto Go ＋ full review（Claude＋GPT）＋ `MESH_WRITE` OFF 確認 |
| main / prod branch push（stage-r15-five-test へ載せ替え） | **Go2 前** | 🔴 Hiroto 裁可（cherry-pick も Go 必須）|
| production data 接続（実 owner の mesh 書き込み） | **Go3** | 🔴 Hiroto Go ＋ 5 人 allowlist 限定 ＋ full review |
| presence 禁止の確認 | 各 Go 前 | §D checklist（presence/ack 非開示）green |
| full review（Claude＋GPT） | Go2・Go3 前 | 本書 ＋ §D 証拠を添えて |
| rollback 座標 | 常時携帯 | §F.1（deploy ID）＋ §G（flag/data 正本）|

### F.1 rollback 座標（deploy）
- 現本番 live（cutover 前の基準・要 deploy 時に最新を確認）: px-r15 deployment **`0ef4646b-2be1-4066-8ad4-90a63177a0bc`（commit 8c4efc0）**。
- Go2/Go3 で新 deployment ID を記録し、**rollback は直前 ID へ Cloudflare ダッシュボードで戻す**。
- D1 は本番と共有のため、deploy rollback では**スキーマは戻らない**（5 表は残る・§G）。

---

## G. rollback の正本

- **`DROP 5 表` は Go1 直後＝本番書き込みが一切無い場合だけ** rollback として扱う。
- **本番データが入った後（Go3 以降）の rollback 正本**:
  1. `MESH_WRITE` フラグ OFF（mesh 書き込み停止）。
  2. legacy-only 書き込みへ戻す。
  3. **dual-read は維持**（mesh 既存データは読めるまま）。
  4. **data を消さない**（mesh に入った既存は残す・relay payload は TTL/ack で自然に減る）。
  - すなわち **schema は残す・書き込みを止める・読みは保つ**。DROP は呼ばない（データ損失になる）。
- deploy 不具合は §F.1 の deployment rollback（コード）と §G の flag OFF（書き込み）を**独立に**使える。

---

## H. ゲート（本 docs 便の合格条件）＋ 順序

合格条件:
- [x] docs-only・本番非接触（D1 --remote / deploy / main / production data に入らない）。
- [x] §A–§F を含む（＋§G rollback 正本・§H）。
- [x] 0015 additive-only を schema diff（CREATE のみ・ALTER/DROP 無・既存不触）で証明（§A.2）。
- [x] 各 Go に rollback 座標 / rollback 手順（§B・§F.1・§G）。
- [x] `DROP 5 表` の適用条件を明記（Go1 直後・書き込み無の時だけ・§G）。
- [ ] **Hiroto ＋ Claude ＋ GPT 一読後に確定**（本書は CC の HOW/cutover 案）。
- 実装 / 本番適用には進まない。

順序:
1. **cutover 準備設計 docs（本書）** → 2. **Hiroto＋Claude＋GPT 一読** → 3. **Memory/Trust 全消去配線**
（`wipeMine`＋確定コピー・破壊操作・**ws-smoke の全消去検査をここで再着地＝次便ゲート**）→
4. **camera / QR scanner** → 5. **本番 migration / deploy / cutover は別 Go**（Go1→Go2→Go3）。

> 本書確定までは赤（本番 D1 `--remote`・deploy・main・production data・presence）に入らない。
