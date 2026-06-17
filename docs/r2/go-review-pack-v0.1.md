# PX Device Mesh — Go review pack v0.1（docs/report のみ・本番非接触）

> Go gate 対話のための一望パック。**本書を読んでも本番には触れない**（`--remote` / deploy / flag flip は
> すべて 🔴 Hiroto Go）。詳細の正本は `docs/r2/cutover-plan-v0.2.md`（以下 §… はそちらを指す）。
> 値は本書作成時点（2026-06-18）。**実行直前に「3」の手順で再確認する**（記憶を信用しない）。

## 1. current branch / commit（cutover 載せ替え元）
- branch: **`stage-r2-complete`** / HEAD: **`8af4ee4`**（MESH_WRITE bootstrap allowlist 反映後）。
- ここに Device Mesh の全 local/dev stack が載っている（registry / handoff / relay / HLC・merge・dual-read /
  Sync UI / confirm-gated seal / MESH_WRITE gate）。**確認手順**: `git -C D:\px-app log --oneline -5`。

## 2. production current deployment / commit / rollback 座標
- Pages project: **`px-r15`**（五人テスト本番）／ production branch: **`stage-r15-five-test`**。
  ※`--branch main` は Preview 扱い＝401（罠・CLAUDE.md）。production branch は `stage-r15-five-test`。
- 現 live deployment（cutover 前の基準）: **`0ef4646b-2be1-4066-8ad4-90a63177a0bc`**（commit **`8c4efc0`**・§F.1）。
- **rollback 座標（直前）**: **`9d0069e8-0aee-4187-9422-32d239d3514f`**（commit `98ad83a`・表層語彙統一）。
- 本番 resource（binding 名＝コードと同一）: D1 **`px-app-board`**（`0c323dfb-…`）／ KV **`AUTH`**（`31c4f53ab2d54dea8a977fa7c719e229`）／ R2 `px-app-deliveries`。
- **確認手順（Go 直前）**: Cloudflare ダッシュボード（px-r15 → Deployments）で現 live ID と直前 ID を**目視で再取得**。
  Go2/Go3 で新 ID を記録し直す（rollback は直前 ID へダッシュボード rollback）。

## 3. pending migration list の確認手順（assert しない・Go 時に実行）
- repo の migration（local 目視）: `0001`–`0012`, `0014`, `0015`（**`0013` 番のファイルは無い**＝欠番。Go 操作者は驚かないこと）。
  mesh 表は **`0015_device_mesh.sql`** のみ（§A.1 の 5 表・additive）。
- **手順**: `npx wrangler d1 migrations list px-app-board --remote` を実行し、**pending が `0015` だけ**であることを目視（§A.2）。
  - もし `0015` 以外も pending なら → **STOP**（prod の適用状態が想定とずれている）。Hiroto と reconcile してから Go1。
  - ※これは本番 D1 への read。**Go 対話に入ってから**実行する（観察期間中の不要な本番 read を避ける）。

## 4. Go1 / Go2 / Go3 実行手順（要点・正本 §B）
- **Go1 — 0015 apply**（5 表を作る・休眠）: `npx wrangler d1 migrations apply px-app-board --remote`。🔴 本番 `--remote`＝Hiroto Go。
  適用後この段で**誰も書かない**（endpoint 未 deploy or mesh-write off）。事前要件: dev/local で 0015 green ＋ §D enforcement green ＋ Claude/GPT が 0015 SQL を一読。
- **Go2 — deploy（mesh write OFF）**: `stage-r2-complete` を prod branch `stage-r15-five-test` へ blessed-stack のみ載せ替え（§F.2）→ deploy。
  env は **`MESH_MODE_CAP=allowlist` ＋ `KV:MESH_MODE=off`**（→ effective=off・relay/handoff/device/register は 403/no-op）。legacy lane 不変。
  🔴 Hiroto Go ＋ full review（Claude＋GPT）＋ `AUTH_SECRET` 設定済・`ALLOW_DEV_SECRET` 不在の確認。
  deploy コマンドは px-r15 の正規手順（CLAUDE.md「デプロイ（px-r15）」§）。**新 deployment ID を記録**。
- **Go3 — cutover flip（5 人限定）**: 「7」で集めた値を env に入れてから **`KV:MESH_MODE=allowlist`**（→ effective=allowlist）。
  - 5 人だけ新規 Talk/Memory delta が mesh lane に乗り始める（§E）。**新 deployment/flip を記録**。
- **global on は別 Go**（`MESH_MODE_CAP=on` ＋ `KV:MESH_MODE=on`）。本パックの射程外。

## 5. 各 Go の rollback 手順（正本 §F.1・§G）
- **Go1 直後（本番書き込みが一切無い場合のみ）**: 5 表 DROP（§A 記載の `DROP TABLE r15_mesh_ack; … r15_owner;`）。
  ※**本番データが入った後は DROP を rollback と呼ばない**（§G）。
- **Go2**: Cloudflare ダッシュボードで**直前 deployment ID（`0ef4646b…`）へ rollback** ＋ `KV:MESH_MODE=off` 確認。legacy lane 維持。
- **Go3 緊急停止**: **`KV:MESH_MODE=off`**（即時・再 deploy 不要）→ legacy-only 書き込みへ戻る。cleanup/safety（ack/purge/revoke/expired/dual-read）は止めない（§G）。
  - **flag OFF は write だけ止める**（実装・smoke 実証済）。既存 mesh payload は TTL で自然消滅（delta 14日 / handoff 72h）。

## 6. env / KV values（初回本番構成・§B.0）
```
# env（Pages・deliberate lever）
MESH_MODE_CAP=allowlist
MESH_OWNER_ALLOWLIST=<5 人の owner_ref（Go3 直前に確定・「7」で収集）>
MESH_BOOTSTRAP_ALLOWLIST=<5 人の passkey handle（Go2 前に確定・「7」で収集）>
AUTH_SECRET=<設定済み・本番 secret>          # ALLOW_DEV_SECRET は置かない（fail-closed）
# KV（AUTH KV・速い lever）
mesh:mode = off        # Go2。Go3 で allowlist。緊急停止で off。
```
- `effective = min(KV:mesh:mode, MESH_MODE_CAP)`。Go2: min(off, allowlist)=off。Go3: min(allowlist, allowlist)=allowlist。
- KV キーは AUTH KV の **`mesh:mode`**（`wrangler kv key put --namespace-id 31c4f53ab2d54dea8a977fa7c719e229 "mesh:mode" "<v>" --remote`）。🔴 本番 KV write＝Go。

## 7. tester 5 人の owner_ref / bootstrap handle 収集手順（2 段・要 Hiroto 裁定の sub-sequencing）
- **bootstrap handle（Go2 前に確定可）**: 5 人の **passkey account handle**（sign-in 済みの handle）。これを `MESH_BOOTSTRAP_ALLOWLIST` に入れる。
  - 収集元: passkey 登録時の handle（owner が sign-in に使うアカウント識別子）。client 申告でなく session が持つ値と一致する必要がある。
- **owner_ref（register で mint・Go3 で確定）**: owner_ref は register 時にサーバが mint するため**事前に分からない**（chicken-egg）。
  - 手順（案・要 Hiroto 確定）: Go3 で `KV:MESH_MODE=allowlist` にすると **bootstrap handle の 5 人だけ register 可**になる →
    5 人が register（owner_ref mint）→ admin が D1 から 5 件の owner_ref を読む
    （`wrangler d1 execute px-app-board --remote --command "SELECT handle, owner_ref FROM r15_owner WHERE handle IN (…5 handle…)"`・metadata read・presence/content を含まない）→
    `MESH_OWNER_ALLOWLIST` に 5 owner_ref を入れて再 deploy → **content write が開く**。
  - ⇒ Go3 は実質 **Go3a（register 開放・owner_ref 収集）→ Go3b（owner allowlist 投入・content 開放）** の 2 段。
    **この 2 段 sequencing は Go 対話で Hiroto 裁定が要る**（本パックの未決事項）。

## 8. smoke commands
- **local gate smoke**（本番非接触・26 検査）: `node scripts\r2-mesh-write-gate-smoke.mjs <al-deny|off|on|al-allow>`
  （mode 切替は `wrangler kv key put … mesh:mode <v> --local` → dev 再起動・CLAUDE.md「Device Mesh の local 設定」）。
- **local 既存 mesh smoke**（mode=on・回帰）: `r2-mesh-smoke`(14) / `r2-mesh-relay-smoke`(23) / `r2-mesh-handoff-smoke`(12) / `r2-mesh-talk-live-smoke`(15)。
- **local 共通**: tsc(0) / `node --test`(652) / `npm run build`(0) / `r2-ws-smoke`(109)。
- **本番 post-deploy smoke（Go2/Go3 後・最小・実施記録つき）**: 無認証 `/port/mcp`・`/api/mesh/*` が **401**（fail-closed）／
  effective=off の間 relay/handoff/device/register が 403・no-op ／ legacy lane（`/api/meet/*`）が従来どおり 200。
  **owner token を mint する bot を本番に当てない**（気配を曇らせる・CLAUDE.md）。認証済の一周は Hiroto のブラウザ。

## 9. no plaintext / no private / no presence の確認項目（§D）
- **no private key**: `r15_owner_epoch` は公開鍵だけ（`isPublicEncJwk` が publish ごと `'d'` 拒否）。device sig/enc も公開鍵のみ。
- **no plaintext**: `r15_mesh_payload` は **ciphertext のみ**（epoch_pub / QR encPub 封緘）。PX は本文・epoch private・journal/talk 平文を持たない。
- **no presence**: `devices` 応答は公開メタ（device_id/label/added_at/revoked/here）＋ capability（mode/writeAllowed）だけ。
  最終取得・オンライン・相手側 delivery state・閲覧者を**出さない**。`mesh_ack` は purge 判定の内部資料で counterparty に出さない。
- **capability の additive field**（§B.0・API contract）: `mode`/`writeAllowed` は互換追加。owner 自身の可否だけで他者の allowlist 在否を漏らさない。
- **手順**: 0015 SQL を一読（公開鍵列・ciphertext 列・presence 列が無いこと）＋ §D checklist 走査 ＋ 上記 local smoke の presence 不在断言。

## 10. STOP 条件（この線に触れたら止まる）
- 🔴 本番 `px-app-board` への `--remote`（Go1 以外）／schema 破壊（DROP・additive 以外の ALTER）。
- 🔴 px-r15 への deploy／prod branch `stage-r15-five-test` への載せ替え／main 直 push。
- 🔴 production data 接続（実 owner の mesh 書き込み）＝Go3。global on＝別 Go。
- 🔴 private/鍵/平文/presence の漏れ形・law 変更・ランキング/課金の忍び込み。
- 🟥 camera/QR scanner・Phase D（edge_note mesh 化）は本パックの射程外（実装しない）。
- いずれも **本パックは docs/report のみ**。Go 対話で Hiroto Go を得るまで本番に触れない。

### 未決（Go 対話で要 Hiroto 裁定）
1. Go3 の 2 段 sequencing（Go3a register 開放→owner_ref 収集→Go3b owner allowlist 投入）＝「7」。
2. prod の現 migration 適用状態（「3」で `migrations list --remote` を実行して 0015 のみ pending を確認）。
3. tester 5 人の passkey handle の確定（`MESH_BOOTSTRAP_ALLOWLIST` の中身）。
