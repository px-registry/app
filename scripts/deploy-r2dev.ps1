# deploy-r2dev.ps1 — R2 完成形建設の隔離現場 (px-r2-dev) へ deploy する唯一の正規経路。
#
# 実測 (便1 2026-06-12): `wrangler pages deploy` は --config を受けない
# ("Pages does not support custom paths for the Wrangler configuration file")。
# d1 migrations apply は --config を受ける。よって deploy だけ wrangler.toml を
# 一時的に dev 版へ差し替え、finally で必ず本番版へ戻す。
#
# 隔離の規律:
#   - 本番 five-test (px-r15 / px-app-board) にはこのスクリプトは一切触れない。
#   - migration の dev 適用は:
#       npx wrangler d1 migrations apply px-app-board-r2dev --remote --config wrangler.r2dev.toml
#   - 0010 以降を本番 px-app-board へ --remote 適用するのはカットオーバーゲート後のみ。

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not (Test-Path wrangler.r2dev.toml)) { throw 'wrangler.r2dev.toml が見つからない' }

npm run build
if ($LASTEXITCODE -ne 0) { throw 'build failed' }

Copy-Item wrangler.toml tmp-wrangler.prod.toml -Force
try {
  Copy-Item wrangler.r2dev.toml wrangler.toml -Force
  npx wrangler pages deploy out --project-name px-r2-dev --branch stage-r2-complete --commit-dirty=true
  if ($LASTEXITCODE -ne 0) { throw 'deploy failed' }
} finally {
  # 何があっても wrangler.toml は本番版へ戻す (戻し忘れ = 次の本番 deploy が dev 資源を向く事故)
  Copy-Item tmp-wrangler.prod.toml wrangler.toml -Force
  Remove-Item tmp-wrangler.prod.toml -Force
}
