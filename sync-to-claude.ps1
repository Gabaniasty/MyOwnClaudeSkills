<#
.SYNOPSIS
  Installs every skill in skills/ into %USERPROFILE%\.claude\skills\.

.DESCRIPTION
  Claude Code reads skills from ~/.claude/skills at session start. This repo is the source
  of truth; this script copies into that location. Re-run after editing a skill, then start
  a new session for the change to take effect.

.EXAMPLE
  .\sync-to-claude.ps1
  .\sync-to-claude.ps1 -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = "Stop"

$repoSkills = Join-Path $PSScriptRoot "skills"
$target     = Join-Path $env:USERPROFILE ".claude\skills"

if (-not (Test-Path $repoSkills)) { throw "No skills/ directory at $repoSkills" }
if (-not (Test-Path $target)) { New-Item -ItemType Directory -Force $target | Out-Null }

$installed = 0
foreach ($skill in Get-ChildItem $repoSkills -Directory) {
    $manifest = Join-Path $skill.FullName "SKILL.md"
    if (-not (Test-Path $manifest)) {
        Write-Warning "skipping $($skill.Name): no SKILL.md"
        continue
    }

    $dest = Join-Path $target $skill.Name
    if ($PSCmdlet.ShouldProcess($dest, "install $($skill.Name)")) {
        # Replace wholesale so files deleted from the repo do not linger in the install.
        if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
        Copy-Item $skill.FullName $dest -Recurse -Force

        $files = (Get-ChildItem $dest -Recurse -File).Count
        Write-Host ("  {0,-24} {1,3} files -> {2}" -f $skill.Name, $files, $dest)
        $installed++
    }
}

Write-Host ""
Write-Host "$installed skill(s) installed. Start a new Claude Code session to pick them up."
