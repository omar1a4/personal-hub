$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$node = Get-ChildItem (Join-Path $root '.tools') -Filter 'node-v22.*-win-x64' -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $node) { throw 'Run scripts/install.ps1 first.' }
$env:PATH = "$($node.FullName);$env:PATH"
Push-Location $root
try { & npm.cmd start } finally { Pop-Location }