$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$tools = Join-Path $root '.tools'
New-Item -ItemType Directory -Force $tools | Out-Null
$releases = Invoke-RestMethod 'https://nodejs.org/dist/index.json'
$release = $releases | Where-Object { $_.version -like 'v22.*' -and $_.lts } | Select-Object -First 1
if (-not $release) { throw 'No Node 22 LTS release was returned by nodejs.org.' }
$archiveName = "node-$($release.version)-win-x64.zip"
$nodeDirectory = Join-Path $tools "node-$($release.version)-win-x64"
if (-not (Test-Path (Join-Path $nodeDirectory 'node.exe'))) {
    $archive = Join-Path $tools $archiveName
    Invoke-WebRequest "https://nodejs.org/dist/$($release.version)/$archiveName" -OutFile $archive -UseBasicParsing
    $checksums = (Invoke-WebRequest "https://nodejs.org/dist/$($release.version)/SHASUMS256.txt" -UseBasicParsing).Content
    $checksumLine = $checksums -split "`n" | Where-Object { $_.Trim().EndsWith("  $archiveName") } | Select-Object -First 1
    if (-not $checksumLine) { throw 'Official Node checksum not found.' }
    $expected = ($checksumLine.Trim() -split '\s+')[0]
    if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne $expected) { throw 'Node archive checksum mismatch.' }
    Expand-Archive $archive -DestinationPath $tools -Force
    Remove-Item $archive
}
$env:PATH = "$nodeDirectory;$env:PATH"
& (Join-Path $nodeDirectory 'node.exe') --version
& (Join-Path $nodeDirectory 'npm.cmd') --version
$commit = '0a36fefeb913055c8c7a1a29b63d82b96b2e841a'
$devkit = Join-Path $tools "sign-in-with-chatgpt-devkit-$commit"
if (-not (Test-Path (Join-Path $devkit 'packages/local/package.json'))) {
    $archive = Join-Path $tools 'siwc.zip'
    Invoke-WebRequest "https://codeload.github.com/openai/sign-in-with-chatgpt-devkit/zip/$commit" -OutFile $archive -UseBasicParsing
    Expand-Archive $archive -DestinationPath $tools -Force
    Remove-Item $archive
}
Write-Output "Official DevKit source ready at pinned commit $commit."