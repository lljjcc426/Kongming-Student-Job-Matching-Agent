[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateLength(1, 10)]
  [string]$TeamName,
  [string]$OutputRoot = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputRoot) { $OutputRoot = Join-Path $repoRoot 'output\semifinal-20260927' }
$outputPath = [System.IO.Path]::GetFullPath($OutputRoot)
if ([System.IO.Path]::GetPathRoot($outputPath) -ne 'D:\') {
  throw 'Preflight artifacts must remain on drive D.'
}

$hapPath = Join-Path $repoRoot 'harmony\entry\build\default\outputs\default\entry-default-unsigned.hap'
if (-not (Test-Path -LiteralPath $hapPath -PathType Leaf)) {
  throw 'Build the offline native Release HAP before packaging.'
}
$hapArchive = [System.IO.Compression.ZipFile]::OpenRead($hapPath)
try {
  $moduleEntry = $hapArchive.GetEntry('module.json')
  if (-not $moduleEntry) { throw 'HAP module.json is missing.' }
  $reader = New-Object System.IO.StreamReader($moduleEntry.Open())
  try { $moduleInfo = $reader.ReadToEnd() | ConvertFrom-Json } finally { $reader.Dispose() }
  if ($moduleInfo.app.bundleName -ne 'cn.kongming.jobmatch' -or
      $moduleInfo.app.buildMode -ne 'release' -or $moduleInfo.app.debug -ne $false) {
    throw 'Expected the native cn.kongming.jobmatch Release HAP with debug=false.'
  }
  $forbiddenEntries = @($hapArchive.Entries | Where-Object {
    $_.FullName -match '(?i)(^|/)(resfile|\.env[^/]*)(/|$)|professional-interviewer-v[34]\.glb|interviewOffice(?:V2)?\.jpg|\.(p12|pfx|pem|key)$'
  })
  if ($forbiddenEntries.Count -gt 0) { throw 'HAP contains excluded legacy or private files.' }
  if (-not $hapArchive.GetEntry('resources/rawfile/avatar/professional-interviewer-v5.glb') -or
      -not $hapArchive.GetEntry('resources/base/media/interviewOfficeV3.jpg')) {
    throw 'Expected current native interviewer and office assets.'
  }
} finally { $hapArchive.Dispose() }

$files = [ordered]@{
  'app/entry-default-unsigned.hap' = $hapPath
  'README.md' = (Join-Path $repoRoot 'docs\competition\PREFLIGHT_INSTALL.md')
  'demo/anonymous-resume.txt' = (Join-Path $repoRoot 'docs\competition\fixtures\anonymous-resume.txt')
  'demo/synthetic-jd.txt' = (Join-Path $repoRoot 'docs\competition\fixtures\synthetic-jd.txt')
  'demo/fixture-provenance.json' = (Join-Path $repoRoot 'docs\competition\fixtures\fixture-provenance.json')
  'licenses/LICENSE' = (Join-Path $repoRoot 'LICENSE')
  'licenses/NOTICE' = (Join-Path $repoRoot 'NOTICE')
  'licenses/THIRD_PARTY_LICENSES.md' = (Join-Path $repoRoot 'docs\THIRD_PARTY_LICENSES.md')
  'licenses/OPEN_SOURCE_ATTRIBUTION.md' = (Join-Path $repoRoot 'docs\OPEN_SOURCE_ATTRIBUTION.md')
  'licenses/rocketbox-source.md' = (Join-Path $repoRoot 'scripts\assets\rocketbox-business-female-04\SOURCE.md')
  'licenses/rocketbox-MIT.md' = (Join-Path $repoRoot 'scripts\assets\rocketbox-business-female-04\LICENSE-Microsoft-Rocketbox.md')
  'licenses/resume-pdf.txt' = (Join-Path $repoRoot 'harmony\entry\src\main\resources\rawfile\licenses\resume-pdf.txt')
}

$fileRecords = @()
foreach ($packageEntry in $files.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $packageEntry.Value -PathType Leaf)) {
    throw "Missing allowlisted file: $($packageEntry.Key)"
  }
  $fileRecords += [ordered]@{
    path = $packageEntry.Key
    bytes = (Get-Item -LiteralPath $packageEntry.Value).Length
    sha256 = (Get-FileHash -LiteralPath $packageEntry.Value -Algorithm SHA256).Hash.ToLowerInvariant()
  }
}
$baseline = & git -C $repoRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Unable to determine the source baseline.' }
$workingTree = @(& git -C $repoRoot status --porcelain)
if ($LASTEXITCODE -ne 0) { throw 'Unable to determine working tree status.' }
$manifest = [ordered]@{
  schemaVersion = 1
  packagePurpose = 'offline-native-preflight-not-submission'
  teamName = $TeamName
  track = 'application-innovation'
  createdAtUtc = [DateTime]::UtcNow.ToString('o')
  baselineCommit = [string]$baseline
  uncommittedChanges = ($workingTree.Count -gt 0)
  readyForSubmission = $false
  buildMode = $moduleInfo.app.buildMode
  debug = $moduleInfo.app.debug
  signed = $false
  bundleName = $moduleInfo.app.bundleName
  versionName = $moduleInfo.app.versionName
  minAPIVersion = $moduleInfo.app.minAPIVersion
  targetAPIVersion = $moduleInfo.app.targetAPIVersion
  onlineServiceVerified = $false
  runtimeValidation = 'See README; package metadata is not an installation or E2E certificate.'
  demoData = 'Artificial anonymous fixtures; not real student evidence or live recruitment.'
  blockers = @(
    'Official evaluator installation and signing route not verified.'
    'Public HTTPS gateway and independent online E2E acceptance not complete.'
    'Real-device speech, camera and system capability checks pending.'
    'Team details and required signatures incomplete.'
    'Actual MP4 demonstration not recorded.'
    'Remaining native brand/foreground asset provenance requires review.'
  )
  files = $fileRecords
}

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
$manifestJson = $manifest | ConvertTo-Json -Depth 10
$zipPath = Join-Path $outputPath '03-kongming-offline-preflight-20260927.zip'
$stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::ReadWrite)
$archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
try {
  foreach ($packageEntry in $files.GetEnumerator()) {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $packageEntry.Value, $packageEntry.Key) | Out-Null
  }
  $manifestEntry = $archive.CreateEntry('manifest.json')
  $writer = New-Object System.IO.StreamWriter($manifestEntry.Open(), $utf8)
  try { $writer.Write($manifestJson) } finally { $writer.Dispose() }
} finally {
  $archive.Dispose()
  $stream.Dispose()
}
[System.IO.File]::WriteAllText((Join-Path $outputPath 'preflight-manifest.json'), $manifestJson, $utf8)
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText("$zipPath.sha256", "$zipHash  $([System.IO.Path]::GetFileName($zipPath))`n", $utf8)
[pscustomobject]@{
  ZIP = $zipPath
  Bytes = (Get-Item -LiteralPath $zipPath).Length
  SHA256 = $zipHash
  ReadyForSubmission = $false
}
