# PX Device Mesh — Go readiness（pre-flight・1 枚）

> **Go は保留中**（Hiroto 2026-06-18）。本書は「いつでも Go できる」状態の確認表＝Go の瞬間に上から実行する launcher。
> 詳細手順の正本: `docs/r2/go-review-pack-v0.1.md`（§…）＋ `docs/r2/cutover-plan-v0.2.md`。**本書を読んでも本番には触れない**。

## 0. 現在の verified-ready 基線（2026-06-18）
- branch **`stage-r2-complete`** / HEAD **`2fa209e`**（origin と同期・working tree clean）。
- pre-deploy gate green（同 HEAD 実測）: **tsc 0 / `node --test` 652 / `npm run build` 0**。`out/` は deploy 用に最新。
- smoke green（同コードで実測済・コマンドは §3）: gate 26 / mesh base14・relay23・handoff12・talk-live15 / ws 109。
- 本番未接触: Go1/2/3 すべて未実行。production（px-r15）は cutover 前のまま。

## 1. Go の瞬間にやること（順序）
1. **作業ツリー確認**: `git -C D:\px-app status -sb`（clean・origin と同期）＋ HEAD が blessed commit か。
2. **production coordinate 再取得**（観測値は古い・必ず再取得）: Cloudflare ダッシュボード px-r15 → Deployments で
   現 live ID と直前 ID を目視取得（review pack §2 の値は基線・置き換える）。
3. **pre-deploy gate を流す**（§3）。全 green を確認。
4. **Hiroto 側 inputs 確認**（review pack「Go 直前に要るもの」）: 5 人の passkey handle（`MESH_BOOTSTRAP_ALLOWLIST`）。
5. **Go1 → Go2 → Go3a → Go3b → Go3c** を**各段 Hiroto Go で**実行（手順 §4・rollback §5、正本 = review pack §4/§5/§6/§7）。

## 2. 進入禁止（Go なしでは越えない・本書も含め docs/report のみ）
本番 D1 `--remote`（Go1 以外）・px-r15 deploy・prod branch `stage-r15-five-test` 載せ替え・main push・
production data（実 owner mesh write＝Go3）・global on・camera/QR・Phase D edge_note mesh化。

## 3. pre-deploy gate コマンド（local・本番非接触）
```powershell
# 静的ゲート（dev 不要）
npx tsc --noEmit ; node --test ; npm run build
# ワークスペース器（静的・playwright）
python -m http.server 8099 -d out ; node scripts\r2-ws-smoke.mjs
# mesh endpoint 群（要 dev＋KV seed・CLAUDE.md「Device Mesh の local 設定」）
#   .dev.vars: MESH_MODE_CAP=on / MESH_OWNER_ALLOWLIST= / MESH_BOOTSTRAP_ALLOWLIST=（空）
npx wrangler kv key put --namespace-id 31c4f53ab2d54dea8a977fa7c719e229 "mesh:mode" "on" --local
npx wrangler d1 execute px-app-board --local --command "DELETE FROM r15_mesh_ack; DELETE FROM r15_mesh_payload; DELETE FROM r15_device; DELETE FROM r15_owner_epoch; DELETE FROM r15_owner;"
npx wrangler pages dev out --port 8788 --ip 127.0.0.1   # 別シェル
node scripts\r2-mesh-smoke.mjs ; node scripts\r2-mesh-relay-smoke.mjs ; node scripts\r2-mesh-handoff-smoke.mjs ; node scripts\r2-mesh-talk-live-smoke.mjs
# MESH_WRITE gate（mode 切替は KV reseed→dev 再起動）
node scripts\r2-mesh-write-gate-smoke.mjs <al-deny|off|on|al-allow>
```
- 罠（CLAUDE.md 既焼き）: `wrangler kv --local` は pages dev と同じ state を共有／`Start-Process` は `npx.cmd`／
  bg pages dev の親 node が log を掴むので後始末は CommandLine に `wrangler` を含む node だけ kill。

## 4. Go 実行手順（要点・正本 = review pack §4）
- **Go1**: `npx wrangler d1 migrations apply px-app-board --remote`（事前に `migrations list --remote` で **0015 のみ pending** 目視）。
- **Go2**: `stage-r2-complete`→prod branch 載せ替え（blessed stack のみ）→ px-r15 deploy。env: cap=allowlist・KV mesh:mode=off・
  AUTH_SECRET 設定/ALLOW_DEV_SECRET 不在。新 deployment ID 記録。
- **Go3a/3b/3c**: bootstrap register window → owner_ref 収集 → owner allowlist redeploy → mesh write activation（review pack §4・§7）。

## 5. rollback（常時携帯・正本 = review pack §5・cutover §G）
- **緊急停止（全段）**: `KV:MESH_MODE=off`（即時・cleanup/safety は止めない）。
- **Go1 直後（書き込み皆無時のみ）**: 5 表 DROP。**データ後は DROP を rollback と呼ばない**。
- **Go2**: ダッシュボードで直前 deployment へ rollback ＋ `KV:MESH_MODE=off`。
- **mesh data 後の正本**: pre-mesh へ戻さず「mesh-read capable artifact 維持・write OFF・dual-read 維持・legacy-only write・data 消さない」。

## 6. ready 状態の維持（次セッション/再開時）
- コード不変なら基線（§0）はそのまま。コードを触ったら **§3 gate を流して基線を更新**してから本書の HEAD/数値を直す。
- `.dev.vars`（コミット禁止）は local 既定（cap=on・両 allowlist 空・KV mesh:mode=on）＝ローカル mesh 全開で smoke がそのまま緑。
- 待機点: **Hiroto Go**（Go1 / Go2 / Go3a-b-c の各判断）＋ Go 直前の production coordinate 再取得＋5 人 handle 確定。
