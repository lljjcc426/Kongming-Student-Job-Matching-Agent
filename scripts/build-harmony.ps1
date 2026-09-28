[CmdletBinding()]
param(
  [string]$DevEcoRoot = 'D:\DevEco Studio',
  [string]$PnpmBin = 'E:\npm-global',
  [string]$LocalDevApiBaseUrl = '',
  [string]$PublicApiBaseUrl = '',
  [string]$GatewayApiUrl = '',
  [string]$AsciiBuildRoot = 'D:\KongMing-Harmony-Build',
  [string]$TempRoot = 'D:\KongMing-Harmony-Temp',
  [string]$UserHomeRoot = 'D:\KongMing-Harmony-User',
  [ValidateSet('debug', 'release')]
  [string]$BuildMode = 'debug',
  [switch]$IncludeWebCompatibility,
  [switch]$RequireOnlineServices
)

$ErrorActionPreference = 'Stop'

if ($RequireOnlineServices -and $LocalDevApiBaseUrl) {
  throw 'Online release builds cannot use LocalDevApiBaseUrl. Configure a public HTTPS gateway instead.'
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$harmonyRoot = Join-Path $repoRoot 'harmony'
$webSyncScript = Join-Path $PSScriptRoot 'sync-harmony-web.ps1'
if (-not (Test-Path -LiteralPath $DevEcoRoot)) {
  throw "DevEco Studio not found at '$DevEcoRoot'. Install DevEco Studio or pass -DevEcoRoot with the actual installation directory."
}
$nodeBin = Join-Path $DevEcoRoot 'tools\node'
$ohpm = Join-Path $DevEcoRoot 'tools\ohpm\bin\ohpm.bat'
$hvigor = Join-Path $DevEcoRoot 'tools\hvigor\bin\hvigorw.bat'
$sdkRoot = Join-Path $DevEcoRoot 'sdk'
$hapPath = Join-Path $harmonyRoot 'entry\build\default\outputs\default\entry-default-unsigned.hap'

& node (Join-Path $PSScriptRoot 'build-resume-pdf-engine.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Native resume PDF engine build failed.' }

foreach ($requiredPath in @($harmonyRoot, $nodeBin, $ohpm, $hvigor, $sdkRoot)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required HarmonyOS path not found: $requiredPath"
  }
}

if ($LocalDevApiBaseUrl) {
  if ($PublicApiBaseUrl -or $GatewayApiUrl) {
    throw 'LocalDevApiBaseUrl cannot be combined with public service URL parameters.'
  }
  $normalizedApiBase = $LocalDevApiBaseUrl.TrimEnd('/')
  $env:KONGMING_GATEWAY_URL = "$normalizedApiBase/api/gateway"
  Write-Output "Embedding local development API base: $normalizedApiBase"
} else {
  if ($PublicApiBaseUrl) {
    if ($GatewayApiUrl) {
      throw 'PublicApiBaseUrl cannot be combined with GatewayApiUrl.'
    }
    $normalizedApiBase = $PublicApiBaseUrl.TrimEnd('/')
    $GatewayApiUrl = "$normalizedApiBase/api/gateway"
  }
  if ($GatewayApiUrl) { $env:KONGMING_GATEWAY_URL = $GatewayApiUrl }
}

function Assert-ServiceUrl([string]$Name, [string]$Value, [bool]$AllowHttpLocalhost) {
  if (-not $Value) { return }
  $uri = $null
  if (-not [System.Uri]::TryCreate($Value, [System.UriKind]::Absolute, [ref]$uri)) {
    throw "$Name must be an absolute URL: $Value"
  }
  $isLocalHttp = $AllowHttpLocalhost -and $uri.Scheme -eq 'http' -and
    $uri.Host -in @('127.0.0.1', 'localhost', '10.0.2.2')
  if ($uri.Scheme -ne 'https' -and -not $isLocalHttp) {
    throw "$Name must use HTTPS for an installable HAP: $Value"
  }
}

$allowLocalHttp = [bool]$LocalDevApiBaseUrl
Assert-ServiceUrl 'KONGMING_GATEWAY_URL' $env:KONGMING_GATEWAY_URL $allowLocalHttp

if ($RequireOnlineServices) {
  if (-not $env:KONGMING_GATEWAY_URL) {
    throw 'KONGMING_GATEWAY_URL is required for an online release HAP. Use -PublicApiBaseUrl or -GatewayApiUrl.'
  }
} elseif (-not $env:KONGMING_GATEWAY_URL) {
  Write-Warning 'Building an offline-capable HAP without a public gateway URL. Local data remains usable; online jobs/model features will report unavailable.'
}

if ($IncludeWebCompatibility) {
  & powershell -NoProfile -ExecutionPolicy Bypass -File $webSyncScript
  if ($LASTEXITCODE -ne 0) {
    throw "Harmony web compatibility resource sync failed with exit code $LASTEXITCODE"
  }
} else {
  $webResourceDir = Join-Path $harmonyRoot 'entry\src\main\resources\resfile'
  if (Test-Path -LiteralPath $webResourceDir) {
    $resolvedWebResourceDir = (Resolve-Path -LiteralPath $webResourceDir).Path
    $expectedWebResourceDir = (Join-Path $harmonyRoot 'entry\src\main\resources\resfile')
    if ($resolvedWebResourceDir -ne $expectedWebResourceDir) {
      throw "Refusing to remove unexpected web resource directory: $resolvedWebResourceDir"
    }
    Remove-Item -LiteralPath $resolvedWebResourceDir -Recurse -Force
  }
  Write-Output 'Native ArkUI build selected; Web compatibility resources are excluded.'
}

$pathPrefix = @($nodeBin)
if (Test-Path -LiteralPath $PnpmBin) {
  $pathPrefix += $PnpmBin
}
$env:PATH = ($pathPrefix -join ';') + ';' + $env:PATH
$env:DEVECO_SDK_HOME = $sdkRoot
$resolvedTempRoot = [System.IO.Path]::GetFullPath($TempRoot)
New-Item -ItemType Directory -Path $resolvedTempRoot -Force | Out-Null
$env:TEMP = $resolvedTempRoot
$env:TMP = $resolvedTempRoot
Write-Output "Using D-drive temporary path: $resolvedTempRoot"

$resolvedUserHomeRoot = [System.IO.Path]::GetFullPath($UserHomeRoot)
New-Item -ItemType Directory -Path $resolvedUserHomeRoot -Force | Out-Null
$homeDrive = Split-Path -Qualifier $resolvedUserHomeRoot
$env:USERPROFILE = $resolvedUserHomeRoot
$env:HOME = $resolvedUserHomeRoot
$env:HOMEDRIVE = $homeDrive
$env:HOMEPATH = $resolvedUserHomeRoot.Substring($homeDrive.Length)
Write-Output "Using D-drive tool home: $resolvedUserHomeRoot"

$buildHarmonyRoot = $harmonyRoot
$stagedBuildRoot = ''
$needsBuildStaging = $harmonyRoot -match '[^\x00-\x7F]' -or [bool]$env:KONGMING_GATEWAY_URL
if ($needsBuildStaging) {
  $stagedBuildRoot = [System.IO.Path]::GetFullPath($AsciiBuildRoot).TrimEnd('\')
  $sourceHarmonyRoot = [System.IO.Path]::GetFullPath($harmonyRoot).TrimEnd('\')
  if ($stagedBuildRoot -eq $sourceHarmonyRoot -or $stagedBuildRoot.StartsWith("$sourceHarmonyRoot\", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "AsciiBuildRoot must be outside the source HarmonyOS project: $stagedBuildRoot"
  }
  if (Test-Path -LiteralPath $stagedBuildRoot) {
    $resolvedStagedRoot = [System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $stagedBuildRoot).Path).TrimEnd('\')
    if ($resolvedStagedRoot -ne $stagedBuildRoot) {
      throw "Refusing to clean unexpected ASCII build root: $resolvedStagedRoot"
    }
    Remove-Item -LiteralPath $resolvedStagedRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Path $stagedBuildRoot -Force | Out-Null
  Get-ChildItem -LiteralPath $harmonyRoot -Force |
    Where-Object { $_.Name -notin @('oh_modules', '.hvigor') } |
    ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $stagedBuildRoot -Recurse -Force
  }
  $buildHarmonyRoot = $stagedBuildRoot
  Write-Output "Using ASCII staging path: $buildHarmonyRoot"

  $excludedAvatarNames = @('professional-interviewer-v3.glb', 'professional-interviewer-v4.glb')
  foreach ($avatarName in $excludedAvatarNames) {
    $legacyAvatar = Join-Path $buildHarmonyRoot "entry\src\main\resources\rawfile\avatar\$avatarName"
    if (Test-Path -LiteralPath $legacyAvatar) {
      Remove-Item -LiteralPath $legacyAvatar -Force
    }
  }
  Write-Output 'Excluded legacy v3 and v4 avatars from the packaged HAP.'

  $excludedOfficeNames = @('interviewOffice.jpg', 'interviewOfficeV2.jpg')
  foreach ($officeName in $excludedOfficeNames) {
    $legacyOffice = Join-Path $buildHarmonyRoot "entry\src\main\resources\base\media\$officeName"
    if (Test-Path -LiteralPath $legacyOffice) {
      Remove-Item -LiteralPath $legacyOffice -Force
    }
  }
  Write-Output 'Excluded unused legacy office backgrounds from the packaged HAP.'
}

function Set-NativeStringResource([string]$ProjectRoot, [string]$ResourceName, [string]$Value) {
  if (-not $Value) { return }
  $resourcePath = Join-Path $ProjectRoot 'entry\src\main\resources\base\element\string.json'
  if (-not (Test-Path -LiteralPath $resourcePath)) {
    throw "Native string resource file not found: $resourcePath"
  }
  $resourceJson = Get-Content -LiteralPath $resourcePath -Raw -Encoding UTF8 | ConvertFrom-Json
  $resource = $resourceJson.string | Where-Object { $_.name -eq $ResourceName } | Select-Object -First 1
  if (-not $resource) {
    throw "Native string resource '$ResourceName' not found in $resourcePath"
  }
  $resource.value = $Value
  $serialized = $resourceJson | ConvertTo-Json -Depth 20
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($resourcePath, $serialized, $utf8NoBom)
}

if ($env:KONGMING_GATEWAY_URL) {
  Set-NativeStringResource $buildHarmonyRoot 'gateway_service_url' $env:KONGMING_GATEWAY_URL
  Write-Output "Embedding native public gateway URL: $env:KONGMING_GATEWAY_URL"
}

$hapPath = Join-Path $buildHarmonyRoot 'entry\build\default\outputs\default\entry-default-unsigned.hap'
$outputHapPath = Join-Path $harmonyRoot 'entry\build\default\outputs\default\entry-default-unsigned.hap'
$buildSucceeded = $false

Push-Location $buildHarmonyRoot
try {
  & $ohpm install
  if ($LASTEXITCODE -ne 0) {
    throw "ohpm install failed with exit code $LASTEXITCODE"
  }

  & $hvigor `
    --max-old-space-size=8192 `
    --max-semi-space-size=128 `
    --mode module `
    -p product=default `
    -p module=entry@default `
    -p "buildMode=$BuildMode" `
    assembleHap `
    --no-daemon
  if ($LASTEXITCODE -ne 0) {
    throw "HarmonyOS build failed with exit code $LASTEXITCODE"
  }
  $buildSucceeded = $true
} finally {
  Pop-Location
  if ($stagedBuildRoot) {
    if ($buildSucceeded -and (Test-Path -LiteralPath $hapPath)) {
      $outputHapDirectory = Split-Path -Parent $outputHapPath
      New-Item -ItemType Directory -Path $outputHapDirectory -Force | Out-Null
      Copy-Item -LiteralPath $hapPath -Destination $outputHapPath -Force
    }
    Remove-Item -LiteralPath $stagedBuildRoot -Recurse -Force
  }
}

if (-not (Test-Path -LiteralPath $outputHapPath)) {
  throw "Build completed without the expected HAP: $outputHapPath"
}

$hap = Get-Item -LiteralPath $outputHapPath
$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
  $stream = [System.IO.File]::OpenRead($outputHapPath)
  try {
    $hash = ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '')
  } finally {
    $stream.Dispose()
  }
} finally {
  $sha256.Dispose()
}

[pscustomobject]@{
  HAP = $hap.FullName
  Bytes = $hap.Length
  SHA256 = $hash
  BuildMode = $BuildMode
  Signed = $false
}
