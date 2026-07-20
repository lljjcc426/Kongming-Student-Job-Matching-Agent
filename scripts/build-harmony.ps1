[CmdletBinding()]
param(
  [string]$DevEcoRoot = 'E:\Program Files\Huawei\DevEco Studio',
  [string]$PnpmBin = 'E:\npm-global',
  [string]$LocalDevApiBaseUrl = ''
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$harmonyRoot = Join-Path $repoRoot 'harmony'
$webSyncScript = Join-Path $PSScriptRoot 'sync-harmony-web.ps1'
$nodeBin = Join-Path $DevEcoRoot 'tools\node'
$ohpm = Join-Path $DevEcoRoot 'tools\ohpm\bin\ohpm.bat'
$hvigor = Join-Path $DevEcoRoot 'tools\hvigor\bin\hvigorw.bat'
$sdkRoot = Join-Path $DevEcoRoot 'sdk'
$hapPath = Join-Path $harmonyRoot 'entry\build\default\outputs\default\entry-default-unsigned.hap'

foreach ($requiredPath in @($harmonyRoot, $nodeBin, $ohpm, $hvigor, $sdkRoot)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required HarmonyOS path not found: $requiredPath"
  }
}

if ($LocalDevApiBaseUrl) {
  $normalizedApiBase = $LocalDevApiBaseUrl.TrimEnd('/')
  $env:VITE_JOBS_API_URL = "$normalizedApiBase/api/jobs"
  $env:VITE_ARK_API_URL = "$normalizedApiBase/api/ark"
  Write-Output "Embedding local development API base: $normalizedApiBase"
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $webSyncScript
if ($LASTEXITCODE -ne 0) {
  throw "Harmony web resource sync failed with exit code $LASTEXITCODE"
}

$pathPrefix = @($nodeBin)
if (Test-Path -LiteralPath $PnpmBin) {
  $pathPrefix += $PnpmBin
}
$env:PATH = ($pathPrefix -join ';') + ';' + $env:PATH
$env:DEVECO_SDK_HOME = $sdkRoot

Push-Location $harmonyRoot
try {
  & $ohpm install
  if ($LASTEXITCODE -ne 0) {
    throw "ohpm install failed with exit code $LASTEXITCODE"
  }

  & $hvigor `
    --mode module `
    -p product=default `
    -p module=entry@default `
    -p buildMode=debug `
    assembleHap `
    --no-daemon
  if ($LASTEXITCODE -ne 0) {
    throw "HarmonyOS build failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $hapPath)) {
  throw "Build completed without the expected HAP: $hapPath"
}

$hap = Get-Item -LiteralPath $hapPath
$hash = Get-FileHash -LiteralPath $hapPath -Algorithm SHA256

[pscustomobject]@{
  HAP = $hap.FullName
  Bytes = $hap.Length
  SHA256 = $hash.Hash
}
