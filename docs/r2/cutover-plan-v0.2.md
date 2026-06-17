# PX Device Mesh — 本番 cutover 準備設計（Phase 0.5・草案 v0.2・docs-only）

> **v0.2（2026-06-17・docs patch）**: ① MESH_WRITE/allowlist 方針を固定（緊急 flag=KV・allowlist/cap=env・
> server authoritative・missing/invalid/KV-fail=OFF・client 判断不可・`effective=min(KV:MESH_MODE, MESH_MODE_CAP)`）。
> ② flag が止める/止めない表。③ Go3 後 rollback 正本＝mesh-read capable artifact 維持・write OFF・legacy-only・
> dual-read 維持・data 消さない（pre-mesh deploy へは「mesh 本番データが無い段階まで」だけ）。④ 用語: `dual-write`
> を廃し **forward mesh-write ＋ dual-read**。⑤ `migrations list --remote` は今は実行せず Go1-prep の Hiroto Go 後の
> read-only verification と明記。⑥ preview AUTH_SECRET は preview 専用（DEV_SECRET でも production secret でもない・
> ALLOW_DEV_SECRET は preview/production に置かない）。⑦ §E を「気配ゼロ（presence 禁止）」と「運用 aggregate
> numbers」に分離。⑧ Go2 prod branch diff は blessed stack のみ。⑨ copy catch: `話してみる`（signals.incoming）を
> 「Talk を始めたい」へ（広い sweep は §I で STOP④ 提示）。

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
- 適用前確認（**今は実行しない**）: **Go1-prep の Hiroto Go 後**に、read-only verification として
  `npx wrangler d1 migrations list px-app-board --remote` を実行し **0015 のみ pending**を目視する
  （本 docs 便では本番 `--remote` に一切触れない）。
- 列の不変: `r15_owner_epoch.epoch_pub` は **public JWK のみ**（publish 時に `isPublicEncJwk` で `d` 密輸を 400 拒否）。
  `r15_mesh_payload.ciphertext` は **暗号文のみ**（put で平文形を弾く・PX は平文を持たない）。
  `r15_mesh_ack` は **purge 判定の内部資料**（fetch/応答・UI・presence に出さない）。`expires_at` 列＝TTL 正本。

---

## B. 段階 Go 構造（一括で進めない）

### B.0 MESH_WRITE 方針（mesh 書き込みの可否を決める唯一の判定・server authoritative）
- **緊急停止 flag = KV**（`KV:MESH_MODE`）／**allowlist = env**（`MESH_OWNER_ALLOWLIST`）／**cap = env**（`MESH_MODE_CAP`）。
- 判定は **server authoritative**。**client 判断で mesh write を許可しない**（端末は put を出すだけ・許否はサーバ）。
- **missing / invalid / KV read failure は OFF**（fail-closed）。
- 構成:
```
MESH_MODE_CAP=off | allowlist | on          # env（上限・人手で上げる）
MESH_OWNER_ALLOWLIST=owner_ref_1,owner_ref_2,...   # env（allowlist 対象 owner_ref）
KV:MESH_MODE=off | allowlist | on           # KV（実行時に切替・緊急停止はここ）
effective = min(KV:MESH_MODE, MESH_MODE_CAP)   # 弱い方が勝つ（cap を超えられない）
```
  順序 off < allowlist < on。`effective=allowlist` のとき書込可は **MESH_OWNER_ALLOWLIST に居る owner だけ**。
- 初回本番: `MESH_MODE_CAP=allowlist` / `KV:MESH_MODE=off` / `MESH_OWNER_ALLOWLIST=5人`（→ effective=off・誰も書かない）。
- **Go3**: `KV:MESH_MODE=allowlist`（→ effective=allowlist・5 人だけ書ける）。
- **緊急停止**: `KV:MESH_MODE=off`（→ effective=off・即時・再 deploy 不要）。
- **global on**: **別 Go**（`MESH_MODE_CAP=on` ＋ `KV:MESH_MODE=on`）。

#### B.0 実装済み（2026-06-17・local/dev・本番非接触）
- 判定の正本ロジック = `lib/meet-mesh/mode.ts`（純粋・client と Functions が同一実装を読む）:
  `effectiveMeshMode(cap, kv)=min`（どちらか欠落/不正→off）・`meshWriteAllowed(mode, ownerRef, allowlist)`
  （off→不可・on→owner_ref 形なら可・allowlist→list 内のみ・owner_ref 不在→不可）。unit = `mode.test.ts`（8）。
- Functions: `functions/_mesh.ts` の `meshEffectiveMode(env)`（KV `mesh:mode` を `env.AUTH.get` で読む・try/catch→null→off）と
  `meshWriteGate(env, ownerRef)`。KV は **AUTH KV の `mesh:mode` キー**を使う（新 binding を足さない・allowlist は KV に置かない＝env のみ）。
- **gate を足した write 経路（4）**: `register`（新規 bootstrap）・`device`（device-add）・`relay/put`・`handoff/put`。
  ※`device`（device-add）は §B.0 の明示3経路に CC 判断で追加（handoff の前段 write・off/rollback で「bundle の付かない孤児 device 行」を防ぐ＝strictly more fail-closed・新データ/意味の拡張なし）。
- **register の chicken-egg 解決**: owner_ref は register で mint されるため allowlist 判定が register 時に不可能。
  → **register は mode>off だけで判定**（off→403 mesh_disabled・allowlist/on→bootstrap 可）。
  **allowlist は content write（relay/handoff/device）側で owner_ref を見て効かせる**。
  既存 owner の register（read・INSERT 無し）は mode 不問で ref を返し、応答に capability を載せる。
- **deny / fallback honesty matrix A**（不許可時の挙動・CC が正直に裁定）:
  | write type | 不許可時 | client fallback | 理由 |
  |---|---|---|---|
  | relay put `talk-msg`（peer） | HTTP 200 `{denied,fallback:"legacy"}` | 既存 envelope へ落とす | Talk 本文を落とさない |
  | relay put `memory-delta`/`talk-mirror`（self） | HTTP 200 `{denied,fallback:"none"}` | no-op（Sync 未有効として静かに） | legacy 等価が無い |
  | `handoff/put` | HTTP 403 `mesh_disabled` | deny（UI は off を正直に表示） | deliberate device-add・等価無し |
  | `device`（device-add） | HTTP 403 `mesh_disabled` | deny | 同上（孤児防止） |
  | `register`（新規） | HTTP 403 `mesh_disabled` | mock に誤魔化さず off 表示 | mode=off は mesh 不有効 |
  - **safety は止めない**（実機確認済）: `relay/fetch`（read）・`relay/purge`（cleanup）は拒否 mode でも 200 ok。
- **capability 表示の正直さ B**: `register`・`devices` 応答に `mode`・`writeAllowed` を同梱（server authoritative）。
  client（`SyncSection`）は `writeAllowed=false` のとき**「同期中」と言わない**（per-device label を抑止）＋ off 状態の一行を出す。
  → off 文言 `MEET.sync.offState` は **★PROVISIONAL（命名ゲート STOP④・Hiroto 確定待ち）**。暫定値「この端末はまだ同期していません。」
- **検証（local/dev）**: endpoint smoke `scripts/r2-mesh-write-gate-smoke.mjs <al-deny|off|on|al-allow>`（23 検査）。
  `KV:mesh:mode` を session ごとに reseed（`wrangler kv key put --namespace-id <AUTH> mesh:mode <v> --local`）→ dev 再起動。
  flag flip で**再 register なしに** write 可否が変わること（rollback 復帰）を on session で実証。既存 mesh smoke は
  mode=on で全 green（base14/relay23/handoff12/talk-live15）＝gate が既存 flow を壊さない。
- **local 既定**（`.dev.vars`・コミットしない）: `MESH_MODE_CAP=on` ＋ `MESH_OWNER_ALLOWLIST=`（空）＋ KV `mesh:mode=on` seed
  ＝ローカルは mesh 全開（建設現場）。本番は §B.0 の初回構成（cap=allowlist・KV=off）。

### B.0b flag が止めるもの / 止めないもの
| 止める（effective=off / allowlist 外） | 止めない（rollback でも安全・cleanup 経路） |
|---|---|
| 新規 mesh write（relay put 全般） | dual-read（legacy + mesh fetch） |
| Talk mesh send（talk-msg / talk-mirror put） | legacy read / write（r15_envelope） |
| Memory delta mesh send（memory-delta put） | ack（受領記録） |
| allowlist 外 owner の mesh write | purge / owner purge（exit-safe） |
| cutover 対象外 owner の mesh write | revoke（端末を外す）|
| 新規 handoff put / mesh payload put（write 扱い） | expired cleanup（TTL GC）|
| device-add / register（新規 bootstrap・write 扱い） | 既存 mesh payload の回収（fetch/ack/purge）|
|  | relay fetch（read）・devices（read・capability 同梱）|
- **rollback 時は write を止める。cleanup / safety path（ack・purge・revoke・expired・dual-read）は止めない。**

### Go1 — 0015 apply（5 表を作る・休眠）
- 操作: `npx wrangler d1 migrations apply px-app-board --remote`（本番 D1）。**🔴 本番 `--remote`＝Hiroto Go 必須。**
- この段階で **誰も書かない**（endpoint 未 deploy or mesh-write OFF）。5 表は空・休眠。
- **要件**: 適用前に dev/local/preview で 0015 green（既済）＋ §D enforcement green ＋ Claude/GPT が 0015 SQL を一読。
- **rollback（Go1 直後・本番書き込みが一切無い場合のみ）**: `DROP TABLE r15_mesh_ack; … r15_owner;`（5 表 DROP）。
  ※**本番データが入った後は DROP を rollback と呼ばない**（§G）。

### Go2 — deploy（endpoint/UI は在る・mesh 書き込みは OFF/opt-in）
- 操作: Device Mesh を本番 Pages（px-r15・production branch=`stage-r15-five-test`）へ deploy。
  コードは現在 `stage-r2-complete`。**prod branch への載せ替え（cherry-pick/merge）＋ deploy ＝ 🔴 Hiroto Go＋full review。**
- **mesh 書き込みは effective=off**（`MESH_MODE_CAP=allowlist` ＋ `KV:MESH_MODE=off`・§B.0）。relay put 系（write）は
  effective=off の間 **403/no-op**。legacy lane は不変で稼働。
- **rollback**: Cloudflare ダッシュボードで**直前 deployment へ rollback**（座標 §F.1）。`KV:MESH_MODE=off` を確認。
  legacy lane 維持（mesh は休眠のまま）。pre-mesh deploy へ戻せる段（mesh データ前）。
- secrets: `AUTH_SECRET` が production に設定済みであること（§D）。`ALLOW_DEV_SECRET` は **置かない**。

### Go3 — cutover 起動（mesh 書き込み ON・最初は 5 人限定）
- 操作: `KV:MESH_MODE=allowlist`（cap=allowlist・`MESH_OWNER_ALLOWLIST`=5 人）→ **effective=allowlist**。
  allowlist の 5 人だけ新規 Talk/Memory delta が mesh lane に乗り始める。
- **🔴 Hiroto Go ＋ full review（Claude＋GPT）後**にだけ flip。
- **rollback（本番データ後の正本・§G）**: `KV:MESH_MODE=off`（即時）→ **legacy-only 書き込みへ戻す** →
  **dual-read は維持** → **mesh に入った既存データは消さず、読めるものとして残す** → **データ損失を起こさない**。

---

## C. dual-read cutover 状態機械

```
[legacy-only]    全書き込み legacy（r15_envelope）。mesh 休眠。              ← Go2 まで
    │ Go3 flip（allowlist 内）
    ▼
[forward mesh-write ＋ dual-read]   （※「dual-write」とは呼ばない — 同一新規 message を legacy と mesh の両方へ
                                       書く設計ではない。forward write to mesh lane, read both legacy and mesh lanes.）
    - 新規 Talk message / Memory delta は **mesh lane**（talk-msg / memory-delta）へ（前向き＝forward のみ）。
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
  - preview の `AUTH_SECRET` は **preview 専用の値**＝**DEV_SECRET ではない**・**production secret でもない**（別管理）。
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

**広げる判断点**: 上記 10 項目が 5 人で green ＋ §E.2 の aggregate numbers が健全 ＋ presence 漏れゼロ
→ **Hiroto 裁定で allowlist 解除（全テスター）**。それまで allowlist 外は legacy-only（mesh 書き込み OFF）。

### E.2 運用 numbers（aggregate のみ・「気配ゼロ」とは別物）
**気配ゼロ ＝ presence を一切出さない（憲法）**。運用の健全性は **aggregate（owner をまたいだ合算）numbers** で見る ——
個人が見えない形だけ。
- 見てよい（aggregate）: relay held payload 数／expired payload 数／purge 完了数／fully-acked→purged の lag／
  relay fetch 成否数／401・409 率／decrypt 失敗数／handoff 成否数／mesh write の fallback-to-legacy 数／
  duplicate suppression 数／owner purge 数／revoke 数。
- **禁止（presence・個人特定）**: per-owner online/offline／per-owner last seen／per-owner read status／
  相手の端末数表示／相手の ack 進捗表示／Talk 相手ごとの presence 推定／**small cohort で個人が推測できる
  dashboard 表示**（5 人規模では特に — 合算でも人数が小さいと個人が割れる指標は出さない）。

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

### F.2 Go2 prod branch diff ＝ blessed stack のみ
prod branch（`stage-r15-five-test`）へ載せ替える diff は **Device Mesh の blessed stack だけ**に絞る（無関係変更を混ぜない）。
- **含める**: A registry／B handoff／C・C.1 relay・merge・dual-read／UI便（Sync 実機配線・confirm-gated handoff・
  Talk dual-read live wiring）／live render smoke／flag・allowlist 便（Go2 前に実装される）。
- **含めない**: Phase D edge_note mesh 化／camera・QR scanner／未確定コピー／unrelated cleanup／
  production-adjacent refactor。
- diff レビュー（full review・Claude＋GPT）はこの blessed stack に対して行う。

---

## G. rollback の正本

- **`DROP 5 表` は Go1 直後＝本番書き込みが一切無い場合だけ** rollback として扱う。
- **本番データが入った後（Go3 以降）の rollback 正本**:
  0. **mesh-read capable な artifact を維持する**（＝**pre-mesh deploy へ戻すことを正本にしない**）。読めないと
     mesh に入った既存データが宙に浮く。
  1. `KV:MESH_MODE=off`（mesh 書き込み停止・即時）。
  2. legacy-only 書き込みへ戻す。
  3. **dual-read は維持**（mesh 既存データは読めるまま）。
  4. **mesh 既存 data は消さない**（schema/data 残置・relay payload は TTL/ack で自然に減る）。
  - すなわち **mesh-read 可能なまま・書き込みを止める・読みは保つ・data 残置**。DROP も pre-mesh deploy 戻しも呼ばない。
- **pre-mesh deploy（§F.1）へ戻せるのは、mesh 本番データが無い段階（Go2 まで）だけ**。Go3 で mesh データが入ったら
  rollback は §G（flag OFF＋dual-read 維持）が正本。
- deploy 不具合（mesh データ前）は §F.1 の deployment rollback（コード）と flag OFF（書き込み）を**独立に**使える。

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

---

## I. copy catch — `話してみる` の扱い（🟥 STOP④ 提示）

- **済（本便）**: `MEET.home.signals.incoming` を「`{name}さんがTalkを始めたいと伝えました。`」へ（screenshot で
  leak した行・Hiroto 確定候補）。`禁止` 語（話してみる/話せる/マッチング/おすすめ/ランキング/スコア/見回り）に抵触しない。
- **🟥 STOP④（要 Hiroto・未着手）**: `話してみる` は /meet の**中心動詞**として他に少なくとも以下に在る ——
  `signals.heading`「あなたへの「話してみる」」／`signals.talkBack`「こちらも話してみる」／`signals.mutual`
  「おたがいが「話してみる」を押しました。」／`proposal.talk`「話してみる」／`proposal.talkSent`／
  `host.signalsHeading`「「話してみる」のながれ」。
  - これらを一括 sweep するのは**確定済み中心語彙の置換＝命名ゲート**。各箇所の置換文言は Hiroto の確定が要る
    （`incoming` 以外の候補は CC が発明しない）。**いま inconsistent（incoming だけ Talk 語）になっている**点も含め、
    sweep するか／このままにするか裁定を仰ぐ。
  - もし sweep するなら同便で `forbidden.ts` に `話してみる` を追加し M-1/M-2 で恒久化（現状は未追加＝既存 copy を壊さないため）。
