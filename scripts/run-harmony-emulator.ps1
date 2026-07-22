[CmdletBinding()]
param(
  [string]$DevEcoRoot = 'E:\Program Files\Huawei\DevEco Studio',
  [string]$EmulatorName = 'KongMing_API24',
  [string]$InstancePath = 'D:\HarmonyOS-Emulator\instances',
  [string]$ImageRoot = 'D:\HarmonyOS-Emulator\images',
  [ValidateSet('coldboot', 'snapshot', 'reset')]
  [string]$BootMode = 'coldboot',
  [ValidateRange(10000, 16555)]
  [int]$HdcPort = 15555,
  [ValidateRange(1024, 65535)]
  [int]$LocalDevPort = 5173,
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

$instanceJson = & $emulator -list -details
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
    & $emulator -stop $EmulatorName | Out-Null
    for ($attempt = 1; $attempt -le 20; $attempt++) {
      Start-Sleep -Seconds 2
      $stoppedState = (& $emulator -list -details | ConvertFrom-Json) |
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
    '-hdcPort', $HdcPort,
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

& $hdc -t $target shell power-shell wakeup 2>&1 | Out-Null
& $hdc -t $target shell uinput -T -m 628 2400 628 700 800 2>&1 | Out-Null
Start-Sleep -Seconds 2
$launchResult = @(& $hdc -t $target shell aa start -a $AbilityName -b $BundleName 2>&1)
$launchResult | Write-Output
$launchText = $launchResult -join "`n"
if ($LASTEXITCODE -ne 0 -or $launchText -match '\[Fail\]|failed to start ability' -or
  $launchText -notmatch 'start ability successfully') {
  throw "Ability launch failed: $launchText"
}

[pscustomobject]@{
  Emulator = $EmulatorName
  BootMode = $BootMode
  Target = $target
  Bundle = $BundleName
  HAP = $hapPath
  LocalDevApi = "http://127.0.0.1:$LocalDevPort/api"
}
