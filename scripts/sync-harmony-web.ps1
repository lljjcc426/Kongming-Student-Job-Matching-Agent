param(
  [switch]$SkipWebBuild
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $repoRoot 'dist'
$resfilePath = Join-Path $repoRoot 'harmony\entry\src\main\resources\resfile'
$obsoleteRawfilePath = Join-Path $repoRoot 'harmony\entry\src\main\resources\rawfile'
$expectedPrefix = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'harmony\entry\src\main\resources'))
$resolvedResfile = [System.IO.Path]::GetFullPath($resfilePath)
$resolvedObsoleteRawfile = [System.IO.Path]::GetFullPath($obsoleteRawfilePath)

if (-not $resolvedResfile.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or
  -not $resolvedObsoleteRawfile.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to sync outside the Harmony resources directory: $resolvedResfile"
}

if (-not $SkipWebBuild) {
  Push-Location $repoRoot
  try {
    npm run build:web:harmony
    if ($LASTEXITCODE -ne 0) {
      throw "Web build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $distPath 'index.html'))) {
  throw "Web build output is missing: $distPath"
}

New-Item -ItemType Directory -Path $resolvedResfile -Force | Out-Null
Get-ChildItem -LiteralPath $resolvedResfile -Force | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $distPath '*') -Destination $resolvedResfile -Recurse -Force

if (Test-Path -LiteralPath $resolvedObsoleteRawfile) {
  Get-ChildItem -LiteralPath $resolvedObsoleteRawfile -Force | Remove-Item -Recurse -Force
}

$files = Get-ChildItem -LiteralPath $resolvedResfile -Recurse -File
$bytes = ($files | Measure-Object -Property Length -Sum).Sum
Write-Output "Synced $($files.Count) web files to $resolvedResfile"
Write-Output "Web resource bytes: $bytes"
