param(
  [ValidateSet("chrome","firefox","all")]
  [string]$Target = "all"
)

$root = $PSScriptRoot
$ext = Join-Path $root "extension"
$out = Join-Path $root "dist"

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Path $out -Force | Out-Null

function New-Zip {
  param($Source, $ZipPath)
  if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
  Compress-Archive -Path "$Source\*" -DestinationPath $ZipPath
}

if ($Target -eq "chrome" -or $Target -eq "all") {
  Write-Host "Building Chrome (MV3)..."
  $chrome = Join-Path $out "chrome"
  Copy-Item -Recurse $ext $chrome
  Remove-Item -Path (Join-Path $chrome "manifest-v2.json") -Force -ErrorAction SilentlyContinue
  New-Zip -Source $chrome -ZipPath (Join-Path $out "NetMate-Chrome.zip")
  Write-Host "  -> dist/NetMate-Chrome.zip"
}

if ($Target -eq "firefox" -or $Target -eq "all") {
  Write-Host "Building Firefox (MV2)..."
  $ff = Join-Path $out "firefox"
  Copy-Item -Recurse $ext $ff
  Remove-Item -Path (Join-Path $ff "manifest.json") -Force -ErrorAction SilentlyContinue
  Rename-Item -Path (Join-Path $ff "manifest-v2.json") -NewName "manifest.json" -Force
  New-Zip -Source $ff -ZipPath (Join-Path $out "NetMate-Firefox.zip")
  Write-Host "  -> dist/NetMate-Firefox.zip"
}

Write-Host "`nDone! Files in: $out"
