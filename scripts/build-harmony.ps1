[CmdletBinding()]
param(
  [string]$DevEcoRoot = 'E:\Program Files\Huawei\DevEco Studio',
  [string]$PnpmBin = 'E:\npm-global',
  [string]$LocalDevApiBaseUrl = '',
  [string]$PublicApiBaseUrl = '',
  [string]$JobsApiUrl = '',
  [string]$ArkApiUrl = '',
  [string]$HealthApiUrl = '',
  [switch]$RequireOnlineServices
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
  if ($PublicApiBaseUrl -or $JobsApiUrl -or $ArkApiUrl -or $HealthApiUrl) {
    throw 'LocalDevApiBaseUrl cannot be combined with public service URL parameters.'
  }
  $normalizedApiBase = $LocalDevApiBaseUrl.TrimEnd('/')
  $env:VITE_JOBS_API_URL = "$normalizedApiBase/api/jobs"
  $env:VITE_ARK_API_URL = "$normalizedApiBase/api/ark"
  $env:VITE_HEALTH_API_URL = "$normalizedApiBase/api/health"
  Write-Output "Embedding local development API base: $normalizedApiBase"
} else {
  if ($PublicApiBaseUrl) {
    $normalizedApiBase = $PublicApiBaseUrl.TrimEnd('/')
    $JobsApiUrl = "$normalizedApiBase/api/jobs"
    $ArkApiUrl = "$normalizedApiBase/api/ark"
    $HealthApiUrl = "$normalizedApiBase/api/health"
  }
  if ($JobsApiUrl) { $env:VITE_JOBS_API_URL = $JobsApiUrl }
  if ($ArkApiUrl) { $env:VITE_ARK_API_URL = $ArkApiUrl }
  if ($HealthApiUrl) { $env:VITE_HEALTH_API_URL = $HealthApiUrl }
}

function Assert-ServiceUrl([string]$Name, [string]$Value, [bool]$AllowHttpLocalhost) {
  if (-not $Value) { return }
  $uri = $null
  if (-not [System.Uri]::TryCreate($Value, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "$Name must be an absolute URL: $Value"
  }
  $isLocalHttp = $AllowHttpLocalhost -and $uri.Scheme -eq 'http' -and $uri.Host -in @('127.0.0.1', 'localhost')
  if ($uri.Scheme -ne 'https' -and -not $isLocalHttp) {
    throw "$Name must use HTTPS for an installable HAP: $Value"
  }
}

$allowLocalHttp = [bool]$LocalDevApiBaseUrl
Assert-ServiceUrl 'VITE_JOBS_API_URL' $env:VITE_JOBS_API_URL $allowLocalHttp
Assert-ServiceUrl 'VITE_ARK_API_URL' $env:VITE_ARK_API_URL $allowLocalHttp
Assert-ServiceUrl 'VITE_HEALTH_API_URL' $env:VITE_HEALTH_API_URL $allowLocalHttp

if ($RequireOnlineServices) {
  foreach ($requiredVariable in @('VITE_JOBS_API_URL', 'VITE_ARK_API_URL', 'VITE_HEALTH_API_URL')) {
    if (-not (Get-Item -Path "Env:$requiredVariable" -ErrorAction SilentlyContinue).Value) {
      throw "$requiredVariable is required for an online release HAP. Use -PublicApiBaseUrl or the explicit URL parameters."
    }
  }
} elseif (-not $env:VITE_JOBS_API_URL -or -not $env:VITE_ARK_API_URL) {
  Write-Warning 'Building an offline-capable HAP without all public service URLs. Local data remains usable; online jobs/model features will report unavailable.'
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
