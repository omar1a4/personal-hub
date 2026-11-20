$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'bootstrap.ps1')
$root = Split-Path $PSScriptRoot -Parent
$devkit = Join-Path $root '.tools/sign-in-with-chatgpt-devkit-0a36fefeb913055c8c7a1a29b63d82b96b2e841a'
& npm.cmd ci --prefix $devkit --workspace '@siwc/local' --include-workspace-root --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Official DevKit dependency installation failed.' }
& npm.cmd update undici --prefix $devkit --workspace '@siwc/local' --include-workspace-root --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'DevKit transport security update failed.' }
& npm.cmd run build --prefix $devkit --workspace '@siwc/local'
if ($LASTEXITCODE -ne 0) { throw 'Official local SDK build failed.' }
Push-Location $root
try {
    if (Test-Path 'package-lock.json') {
        & npm.cmd ci
    } else {
        & npm.cmd install --save-exact electron lucide @fontsource/dm-sans @fontsource/source-serif-4
    }
    if ($LASTEXITCODE -ne 0) { throw 'Project dependency installation failed.' }
} finally {
    Pop-Location
}