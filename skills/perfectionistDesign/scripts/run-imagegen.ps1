# PHASE 3 — bulletproof image generation via Codex CLI.
#
# Uses YOUR OWN ChatGPT login. There is no API key here and none is needed:
#   codex login --device-auth      (once, if `codex` is not already signed in)
# Nothing in this file contains or asks for a credential.
#
# WHY IT IS BUILT THIS WAY (Gate 8)
# The first run generated a perfect 1.9 MB image and still "failed", because
# `-s workspace-write` did not take effect — the session header reported
# `sandbox: read-only` and codex could not copy the file into the project. The
# image existed in CODEX_HOME the whole time. So this runner NEVER depends on
# codex writing to the project: it lets codex save wherever it wants, then copies
# the file out itself, keyed by SESSION ID so the mapping is exact.
#
# PARALLELISM (Gate 27)
# -Slugs runs only the named assets, so several workers can share the queue.
# -Strict is MANDATORY for those workers: the "newest png anywhere" recovery is
# only sound with exactly one generation in flight, and with two workers it will
# hand worker A's image to worker B's slug. Under -Strict, recovery uses the
# session-id directory alone. Workers skip masters that already exist, so
# overlapping ranges cost time, never correctness.
#
#   .\run-imagegen.ps1 -Root <project>
#   .\run-imagegen.ps1 -Root <project> -Strict -Slugs "hero,bg-aura,cta-phone"
#
# Prompts live in <root>/scratch/prompts/<slug>.txt, one file per asset, each
# ending with the absolute output path. Masters land in <root>/images/_masters.

param(
  [string]$Root = ".",
  [string[]]$Slugs,
  [switch]$Strict,
  [int]$Retries = 3
)

# codex writes to stderr; "Stop" would turn that into a fatal error mid-sequence.
$ErrorActionPreference = "Continue"

$Proj    = (Resolve-Path $Root).Path -replace '\\', '/'
$Prompts = "$Proj/scratch/prompts"
$Masters = "$Proj/images/_masters"
$Scratch = "$Proj/scratch"
$GenRoot = if ($env:CODEX_HOME) { "$env:CODEX_HOME/generated_images" }
           else { "$env:USERPROFILE/.codex/generated_images" }

New-Item -ItemType Directory -Force -Path $Masters, $Scratch | Out-Null

if (-not (Test-Path $Prompts)) {
  Write-Output "no prompts at $Prompts — write one .txt per asset first"
  exit 1
}

# powershell.exe -File passes "a,b,c" as ONE string, so a comma list arrives as a
# single element and matches nothing. Re-split before use (Gate 12) — a first run
# of two workers silently processed an empty queue because of exactly this.
if ($Slugs) {
  $Slugs = @($Slugs -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

# Codex auto-loads whatever global agent skills the user has. One run pulled in a
# `brainstorming` skill whose hard gate forbids acting before presenting a design
# for approval. Either that or a preflight-gate skill will stall a pure generation
# task. This prefix disarms them.
$Guard = @"
This is a single, self-contained image generation task. Do NOT invoke brainstorming,
planning, design-review, spec-writing or approval-gate skills. Do NOT ask questions. Do NOT
write a design document. Generate the image immediately using the built-in image tool.

"@

$order = Get-ChildItem $Prompts -Filter *.txt | ForEach-Object { $_.BaseName }
if ($Slugs) {
  # ordered by -Slugs, not by directory listing: a worker needs to control its own
  # sequence so the most visible assets land first and workers walk away from each other
  $order = @($Slugs | Where-Object { $order -contains $_ })
  Write-Output "worker queue ($($order.Count)): $($order -join ', ')"
}

function Invoke-Generation {
  param([string]$slug, [int]$Attempt)

  $out = "$Masters/$slug.png"
  $log = "$Scratch/$slug.attempt$Attempt.log"

  $cliArgs = @("exec", "--skip-git-repo-check", "-C", $Proj, "-s", "workspace-write",
               "-o", "$Scratch/$slug.result.txt")

  $body = $Guard + (Get-Content "$Prompts/$slug.txt" -Raw)

  # stdin pipe is mandatory on Windows: the npm codex shim re-splits arguments and
  # a prompt containing '-' bullets becomes "unexpected argument '-' found" (Gate 12).
  $body | & codex @cliArgs *>&1 | Tee-Object -FilePath $log | Out-Null
  $code = $LASTEXITCODE

  # --- recovery: a non-zero exit is NOT evidence of a missing artefact (Gate 24) ---
  if (-not (Test-Path $out)) {
    $sid = (Select-String -Path $log -Pattern 'session id:\s*([0-9a-fA-F-]{36})' |
            Select-Object -First 1).Matches.Groups[1].Value
    $hit = $null
    if ($sid -and (Test-Path "$GenRoot/$sid")) {
      $hit = Get-ChildItem "$GenRoot/$sid" -Filter *.png -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }
    if (-not $hit -and -not $Strict -and (Test-Path $GenRoot)) {
      # last resort — ONLY sound when a single generation is in flight
      $hit = Get-ChildItem $GenRoot -Recurse -Filter *.png -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }
    if ($hit) { Copy-Item $hit.FullName $out -Force; Write-Output "     recovered from CODEX_HOME" }
  }

  if (-not (Test-Path $out)) { return @{ ok = $false; reason = "no file produced"; exit = $code } }

  # verify it is a real decodable image, not a truncated write
  $probe = node -e "require('sharp')('$out').metadata().then(m=>console.log(m.width+'x'+m.height)).catch(e=>{console.log('BAD');process.exit(1)})" 2>&1
  if ($probe -match 'BAD' -or -not ($probe -match '^\d+x\d+$')) {
    Remove-Item $out -Force -ErrorAction SilentlyContinue
    return @{ ok = $false; reason = "unreadable image"; exit = $code }
  }
  return @{ ok = $true; size = $probe; kb = [int]((Get-Item $out).Length / 1KB); exit = $code }
}

$done = @(); $failed = @()
foreach ($slug in $order) {
  if (Test-Path "$Masters/$slug.png") { Write-Output "SKIP $slug (exists)"; $done += $slug; continue }
  $result = $null
  foreach ($attempt in 1..$Retries) {
    Write-Output "=== $slug  attempt $attempt/$Retries  $(Get-Date -Format HH:mm:ss) ==="
    $result = Invoke-Generation -slug $slug -Attempt $attempt
    if ($result.ok) { break }
    Write-Output "     retry: $($result.reason) (exit $($result.exit))"
  }
  if ($result.ok) { Write-Output "OK   $slug  $($result.size)  $($result.kb) KB"; $done += $slug }
  else { Write-Output "FAIL $slug  $($result.reason)"; $failed += $slug }
}

Write-Output ""
Write-Output "==================== SUMMARY ===================="
Write-Output "generated: $($done.Count) / $($order.Count)"
if ($failed.Count) { Write-Output "FAILED: $($failed -join ', ')" }
Get-ChildItem $Masters -Filter *.png | Select-Object Name, @{n='KB';e={[int]($_.Length/1KB)}}
if ($failed.Count) { exit 1 }
