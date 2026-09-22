[CmdletBinding()]
param(
  [string]$DevEcoRoot = 'D:\DevEco Studio',
  [string]$EmulatorName = 'KongMing_API24',
  [string]$InstancePath = 'D:\HarmonyOS-Emulator\instances',
  [string]$ImageRoot = 'D:\HarmonyOS-Emulator\images',
  [ValidateSet('coldboot', 'snapshot', 'reset')]
  [string]$BootMode = 'coldboot',
  [ValidateRange(1024, 16555)]
  [int]$HdcPort = 5555,
  [ValidateRange(1024, 65535)]
  [int]$LocalDevPort = 5173,
  [string]$LocalDevHost = '10.0.2.2',
  [string]$BundleName = 'cn.kongming.jobmatch',
  [string]$AbilityName = 'EntryAbility'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$hapPath = Join-Path $repoRoot 'harmony\entry\build\default\outputs\default\entry-default-unsigned.hap'
$emulator = Join-Path $DevEcoRoot 'tools\emulator\Emulator.exe'
$hdc = Join-Path $DevEcoRoot 'sdk\default\openharmony\toolchains\hdc.exe'
$preferredTarget = "127.0.0.1:$HdcPort"

foreach ($requiredPath in @($emulator, $hdc, $hapPath, $InstancePath, $ImageRoot)) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required runtime path not found: $requiredPath"
  }
}

$instanceJson = & $emulator -list -details -instancePath $InstancePath
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to query HarmonyOS emulator instances.'
}
$instances = $instanceJson | ConvertFrom-Json
$instance = $instances | Where-Object { $_.name -eq $EmulatorName } | Select-Object -First 1

if (-not $instance) {
  throw "Emulator instance '$EmulatorName' does not exist."
}

if ([string]$instance.isRunning -eq 'true') {
  & $hdc tconn $preferredTarget 2>&1 | Out-Null
  $runningTargets = @(& $hdc list targets -v)
  $runningConnected = $runningTargets | Where-Object { $_ -match '^127\.0\.0\.1:\d+\s+TCP\s+Connected' } | Select-Object -First 1
  if (-not $runningConnected) {
    Write-Output 'Running emulator has no connected HDC target; restarting it to recover the debug channel.'
    & $emulator -stop $EmulatorName -instancePath $InstancePath | Out-Null
    for ($attempt = 1; $attempt -le 20; $attempt++) {
      Start-Sleep -Seconds 2
      $stoppedState = (& $emulator -list -details -instancePath $InstancePath | ConvertFrom-Json) |
        Where-Object { $_.name -eq $EmulatorName } |
        Select-Object -First 1
      if ([string]$stoppedState.isRunning -ne 'true') { break }
    }
    $instance.isRunning = 'false'
  }
}

if ([string]$instance.isRunning -ne 'true') {
  $arguments = @(
    '-start', $EmulatorName,
    '-instancePath', $InstancePath,
    '-imageRoot', $ImageRoot,
    '-bootmode', $BootMode
  )
  Start-Process -FilePath $emulator -ArgumentList $arguments | Out-Null
}

$connected = $false
$target = $null
for ($attempt = 1; $attempt -le 60; $attempt++) {
  & $hdc tconn $preferredTarget 2>&1 | Out-Null
  $targets = @(& $hdc list targets -v)
  $connectedLine = $targets |
    Where-Object { $_ -match '\s+TCP\s+Connected\s+localhost\s+hdc\s*$' } |
    Select-Object -First 1
  if ($connectedLine) {
    $target = ($connectedLine -split '\s+')[0]
    $connected = $true
    break
  }
  Start-Sleep -Seconds 3
}

if (-not $connected) {
  throw "Emulator did not expose a connected local hdc target (preferred port: $HdcPort)."
}

$systemReady = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
  $bundleDump = @(& $hdc -t $target shell bm dump -a 2>&1)
  $bundleDumpText = $bundleDump -join "`n"
  if ($LASTEXITCODE -eq 0 -and $bundleDumpText -match 'ID:\s*\d+') {
    $systemReady = $true
    break
  }
  Start-Sleep -Seconds 3
}

if (-not $systemReady) {
  throw 'Emulator HDC connected, but Bundle Manager did not become ready.'
}

$reverseResult = @(& $hdc -t $target rport "tcp:$LocalDevPort" "tcp:$LocalDevPort" 2>&1)
$reverseText = $reverseResult -join "`n"
if ($LASTEXITCODE -ne 0 -and $reverseText -notmatch 'Repeat|exist|already') {
  throw "Unable to configure emulator development API reverse port: $reverseText"
}

$installResult = @(& $hdc -t $target install -r $hapPath 2>&1)
$installResult | Write-Output
$installText = $installResult -join "`n"
if ($LASTEXITCODE -ne 0 -or $installText -match '\[Fail\]' -or $installText -notmatch 'successfully') {
  throw "HAP installation failed: $installText"
}

$launchResult = @()
$launchExitCode = 1
$launchText = ''
$launchSucceeded = $false
for ($attempt = 1; $attempt -le 3; $attempt++) {
  & $hdc -t $target shell power-shell wakeup 2>&1 | Out-Null
  & $hdc -t $target shell uinput -T -m 628 2400 628 700 800 2>&1 | Out-Null
  Start-Sleep -Seconds 2
  $launchResult = @(& $hdc -t $target shell aa start -a $AbilityName -b $BundleName 2>&1)
  $launchExitCode = $LASTEXITCODE
  $launchResult | Write-Output
  $launchText = $launchResult -join "`n"
  if ($launchExitCode -eq 0 -and $launchText -notmatch '\[Fail\]|failed to start ability' -and
    $launchText -match 'start ability successfully') {
    $launchSucceeded = $true
    break
  }
  if ($launchText -notmatch '10106102|screen is locked|unlock screen failed') {
    break
  }
  Start-Sleep -Seconds 5
}

if (-not $launchSucceeded) {
  throw "Ability launch failed: $launchText"
}

[pscustomobject]@{
  Emulator = $EmulatorName
  BootMode = $BootMode
  Target = $target
  Bundle = $BundleName
  HAP = $hapPath
  LocalDevApi = "http://${LocalDevHost}:$LocalDevPort/api"
}
