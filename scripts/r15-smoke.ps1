# R1.5 API smoke against wrangler local D1 (real SQL). Scratch — not committed.
$ErrorActionPreference = "Stop"
$base = "http://localhost:8788"
$cred = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('px:local-dev'))
$H = @{ Authorization = "Basic $cred"; Origin = $base }
$fails = 0
function Check($name, $cond) {
  if ($cond) { Write-Host "OK  $name" } else { Write-Host "NG  $name"; $script:fails++ }
}
function PostJson($path, $obj) {
  Invoke-RestMethod -Uri "$base$path" -Method Post -Headers $H -ContentType "application/json" -Body ($obj | ConvertTo-Json -Depth 8)
}

$tokA = "a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1"
$tokB = "b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2"

# 1. publish A + B
$pubA = PostJson "/api/meet/publish" @{ ownerToken = $tokA; displayName = "あや"; items = @(
  @{ kind = "have"; title = "活版印刷の工房"; text = "古い手キンで小ロット印刷ができる"; tags = @("手仕事"); position = 0 },
  @{ kind = "want"; title = "子どもと作る場"; text = "親子で手を動かす時間をつくりたい"; tags = @("親子"); position = 1 }
) }
Check "publish A" ($pubA.ok -and $pubA.count -eq 2)
$refA = $pubA.participantRef
$pubB = PostJson "/api/meet/publish" @{ ownerToken = $tokB; displayName = "カフェの人"; items = @(
  @{ kind = "have"; title = "昼だけのカフェ"; text = "平日昼に間借りで開けている"; tags = @("飲食"); position = 0 },
  @{ kind = "want"; title = "夜の使い手"; text = "夜の時間に店を活かしたい"; tags = @("場所"); position = 1 }
) }
$refB = $pubB.participantRef
Check "publish B" ($pubB.ok -and $refB.Length -eq 16)

# 2. pool self-exclusion
$poolA = Invoke-RestMethod -Uri "$base/api/meet/pool?me=$refA" -Headers $H
Check "pool excludes self" ((($poolA.items | Where-Object { $_.participantRef -eq $refA }).Count -eq 0) -and (($poolA.items | Where-Object { $_.participantRef -eq $refB }).Count -eq 2))
Check "pool no token fields" (-not (($poolA | ConvertTo-Json -Depth 8) -match $tokB))

# 3. private tripwire
try {
  PostJson "/api/meet/publish" @{ ownerToken = $tokA; displayName = "あや"; items = @(@{ kind = "have"; title = "x"; text = "y"; tags = @(); position = 0; private = $false }) } | Out-Null
  Check "tripwire rejects private key" $false
} catch { Check "tripwire rejects private key" ($_.Exception.Response.StatusCode.value__ -eq 400) }

# 4. one-sided signal A -> B
$sig1 = PostJson "/api/meet/signal" @{ ownerToken = $tokA; toRef = $refB; fromName = "あや"; anchor = "工房 × 夜の店" }
Check "signal A->B not yet mutual" ($sig1.ok -and -not $sig1.mutual)
$inboxB = PostJson "/api/meet/inbox" @{ ownerToken = $tokB }
Check "B sees incoming from あや" (($inboxB.incoming | Where-Object { $_.fromName -eq "あや" -and -not $_.mutual }).Count -eq 1)

# 5. contact refused before mutual
try {
  PostJson "/api/meet/contact" @{ ownerToken = $tokA; peerRef = $refB; note = "LINE: aya" } | Out-Null
  Check "contact refused pre-mutual" $false
} catch { Check "contact refused pre-mutual" ($_.Exception.Response.StatusCode.value__ -eq 403) }

# 6. B answers -> mutual; both notes flow
$sig2 = PostJson "/api/meet/signal" @{ ownerToken = $tokB; toRef = $refA; fromName = "カフェの人"; anchor = "" }
Check "signal B->A reports mutual" ($sig2.ok -and $sig2.mutual)
$c1 = PostJson "/api/meet/contact" @{ ownerToken = $tokA; peerRef = $refB; note = "LINE: aya-line" }
Check "contact A stored post-mutual" $c1.ok
$inboxB2 = PostJson "/api/meet/inbox" @{ ownerToken = $tokB }
Check "B receives A's note via mutual join" (($inboxB2.notes | Where-Object { $_.fromRef -eq $refA -and $_.note -eq "LINE: aya-line" }).Count -eq 1)
$inboxA = PostJson "/api/meet/inbox" @{ ownerToken = $tokA }
Check "A sees no note yet (B hasn't written)" ($inboxA.notes.Count -eq 0)

# 7. log + host
$log1 = PostJson "/api/meet/log" @{ ownerToken = $tokA; clientEntryId = "recv_demo1"; displayName = "あや"; question = "PXを広める接点を"; proposalText = "カフェの人：工房 × 夜の店。火曜の夜に一度。"; reading = '{"echo":false,"cards":{"0":{"marks":["面白い"],"note":"具体的"}}}' }
Check "log upsert" $log1.ok
try {
  PostJson "/api/meet/host" @{ hostKey = "wrong" } | Out-Null
  Check "host wrong key 403" $false
} catch { Check "host wrong key 403" ($_.Exception.Response.StatusCode.value__ -eq 403) }
$hostV = PostJson "/api/meet/host" @{ hostKey = "host-local" }
Check "host sees log row" (($hostV.logs | Where-Object { $_.displayName -eq "あや" -and $_.entryId -eq "recv_demo1" }).Count -eq 1)
Check "host sees signal flow" ($hostV.signals.Count -ge 2)
Check "host payload carries no contact note" (-not (($hostV | ConvertTo-Json -Depth 8) -match "aya-line"))

# 8. unpublish via empty list
$un = PostJson "/api/meet/publish" @{ ownerToken = $tokB; displayName = "カフェの人"; items = @() }
$poolA2 = Invoke-RestMethod -Uri "$base/api/meet/pool?me=$refA" -Headers $H
Check "unpublish empties B from pool" ($un.ok -and (($poolA2.items | Where-Object { $_.participantRef -eq $refB }).Count -eq 0))

# 9. re-publish B for the browser smoke
PostJson "/api/meet/publish" @{ ownerToken = $tokB; displayName = "カフェの人"; items = @(
  @{ kind = "have"; title = "昼だけのカフェ"; text = "平日昼に間借りで開けている"; tags = @("飲食"); position = 0 },
  @{ kind = "want"; title = "夜の使い手"; text = "夜の時間に店を活かしたい"; tags = @("場所"); position = 1 }
) } | Out-Null

Write-Host ""
if ($fails -eq 0) { Write-Host "ALL SMOKE CHECKS PASSED" } else { Write-Host "$fails CHECK(S) FAILED"; exit 1 }
