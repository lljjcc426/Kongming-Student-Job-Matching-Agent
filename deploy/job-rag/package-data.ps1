[CmdletBinding()]
param(
  [string]$SourceRoot = "D:\Kongming-RAG\jobs-v1",
  [string]$OutputDirectory = "D:\Kongming-RAG\releases",
  [switch]$AllowLockedSource,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Write-JsonFile {
  param(
    [Parameter(Mandatory = $true)]$Value,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $json = $Value | ConvertTo-Json -Depth 100
  [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine, $utf8NoBom)
}

function New-DeterministicZip {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDirectory,
    [Parameter(Mandatory = $true)][string]$DestinationPath,
    [Parameter(Mandatory = $true)][DateTimeOffset]$Timestamp
  )
  $sourcePrefix = [System.IO.Path]::GetFullPath($SourceDirectory).TrimEnd('\') + '\'
  $archive = [System.IO.Compression.ZipFile]::Open(
    $DestinationPath,
    [System.IO.Compression.ZipArchiveMode]::Create
  )
  try {
    $files = Get-ChildItem -LiteralPath $SourceDirectory -Recurse -File | Sort-Object FullName
    foreach ($file in $files) {
      $entryName = $file.FullName.Substring($sourcePrefix.Length).Replace('\', '/')
      $entry = $archive.CreateEntry(
        $entryName,
        [System.IO.Compression.CompressionLevel]::Optimal
      )
      $entry.LastWriteTime = $Timestamp
      $sourceStream = $null
      $entryStream = $null
      try {
        $sourceStream = $file.OpenRead()
        $entryStream = $entry.Open()
        $sourceStream.CopyTo($entryStream)
      } finally {
        if ($entryStream) { $entryStream.Dispose() }
        if ($sourceStream) { $sourceStream.Dispose() }
      }
    }
  } finally {
    $archive.Dispose()
  }
}

$source = [System.IO.Path]::GetFullPath($SourceRoot)
$output = [System.IO.Path]::GetFullPath($OutputDirectory)
if ([System.IO.Path]::GetPathRoot($output).ToUpperInvariant() -ne "D:\") {
  throw "The job RAG package must be generated on drive D:."
}

$datasetPath = Join-Path $source "jobs-500.jsonl"
$pointerPath = Join-Path $source "index\active-index.json"
$qdrantRoot = Join-Path $source "database\qdrant"
foreach ($requiredPath in @($datasetPath, $pointerPath, (Join-Path $qdrantRoot "meta.json"))) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required job knowledge file is missing: $requiredPath"
  }
}

$lockPath = Join-Path $qdrantRoot ".lock"
if ((Test-Path -LiteralPath $lockPath) -and -not $AllowLockedSource) {
  $lockStream = $null
  try {
    $lockStream = [System.IO.File]::Open(
      $lockPath,
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::ReadWrite,
      [System.IO.FileShare]::None
    )
  } catch {
    throw "Qdrant is locked. Stop the local worker, or use -AllowLockedSource only for a read-only database."
  } finally {
    if ($lockStream) {
      $lockStream.Dispose()
    }
  }
}

$pointer = Get-Content -LiteralPath $pointerPath -Raw -Encoding UTF8 | ConvertFrom-Json
$versionId = [string]$pointer.version_id
if ($versionId -notmatch '^[A-Za-z0-9._-]{8,160}$') {
  throw "active-index.json contains an invalid version_id."
}
$versionSource = Join-Path $source "index\versions\$versionId"
$manifestPath = Join-Path $versionSource "manifest.json"
if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "The active index is missing manifest.json: $versionId"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$collectionName = [string]$manifest.database.collection
if ($collectionName -notmatch '^[A-Za-z0-9._-]{8,160}$') {
  throw "manifest.json contains an invalid Qdrant collection."
}
$collectionSource = Join-Path $qdrantRoot "collection\$collectionName"
if (-not (Test-Path -LiteralPath $collectionSource)) {
  throw "The active Qdrant collection is missing: $collectionName"
}

New-Item -ItemType Directory -Path $output -Force | Out-Null
$stage = Join-Path $output (".job-rag-package-" + [guid]::NewGuid().ToString("N"))
$stageDataset = Join-Path $stage "jobs-v1"
$temporaryArchive = $null
try {
  New-Item -ItemType Directory -Path (Join-Path $stageDataset "index\versions") -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $stageDataset "database\qdrant\collection") -Force | Out-Null

  Copy-Item -LiteralPath $datasetPath -Destination (Join-Path $stageDataset "jobs-500.jsonl")
  Copy-Item -LiteralPath $versionSource -Destination (Join-Path $stageDataset "index\versions") -Recurse
  Copy-Item -LiteralPath $collectionSource -Destination (Join-Path $stageDataset "database\qdrant\collection") -Recurse

  $portablePointer = [ordered]@{
    version_id = $versionId
    version_dir = "index/versions/$versionId"
    activated_at = [string]$pointer.activated_at
  }
  Write-JsonFile -Value $portablePointer -Path (Join-Path $stageDataset "index\active-index.json")

  $portableManifestPath = Join-Path $stageDataset "index\versions\$versionId\manifest.json"
  $portableManifest = Get-Content -LiteralPath $portableManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $portableManifest.dataset_path = "jobs-500.jsonl"
  $portableManifest.database.path = "database/qdrant"
  $portableManifest.storage_dir = "database/qdrant"
  Write-JsonFile -Value $portableManifest -Path $portableManifestPath

  $qdrantMeta = Get-Content -LiteralPath (Join-Path $qdrantRoot "meta.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  $collectionProperty = $qdrantMeta.collections.PSObject.Properties[$collectionName]
  if (-not $collectionProperty) {
    throw "Qdrant meta.json does not contain the active collection."
  }
  $portableCollections = [ordered]@{}
  $portableCollections[$collectionName] = $collectionProperty.Value
  $portableMeta = [ordered]@{
    collections = $portableCollections
    aliases = [ordered]@{}
  }
  Write-JsonFile -Value $portableMeta -Path (Join-Path $stageDataset "database\qdrant\meta.json")

  $packageManifest = [ordered]@{
    schema_version = "1.0"
    version_id = $versionId
    dataset_sha256 = [string]$manifest.dataset_sha256
    record_count = [int]$manifest.record_count
    node_count = [int]$manifest.node_count
    collection = $collectionName
    created_at = [string]$manifest.built_at
  }
  Write-JsonFile -Value $packageManifest -Path (Join-Path $stageDataset "package-manifest.json")

  $archiveName = "kongming-job-rag-data-$versionId.zip"
  $archivePath = Join-Path $output $archiveName
  $temporaryArchive = Join-Path $output (".$archiveName." + [guid]::NewGuid().ToString("N") + ".tmp.zip")
  $archiveTimestamp = [DateTimeOffset]::Parse([string]$manifest.built_at)
  New-DeterministicZip -SourceDirectory $stage -DestinationPath $temporaryArchive -Timestamp $archiveTimestamp
  $temporaryHash = (Get-FileHash -LiteralPath $temporaryArchive -Algorithm SHA256).Hash.ToLowerInvariant()

  if (Test-Path -LiteralPath $archivePath) {
    $existingHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($existingHash -eq $temporaryHash) {
      Remove-Item -LiteralPath $temporaryArchive -Force
      $temporaryArchive = $null
    } elseif (-not $Force) {
      throw "The package already exists with different content. Inspect the version or explicitly use -Force."
    } else {
      $backupPath = "$archivePath.backup-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
      Move-Item -LiteralPath $archivePath -Destination $backupPath
      Move-Item -LiteralPath $temporaryArchive -Destination $archivePath
      $temporaryArchive = $null
    }
  } else {
    Move-Item -LiteralPath $temporaryArchive -Destination $archivePath
    $temporaryArchive = $null
  }

  $archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  $hashPath = "$archivePath.sha256"
  [System.IO.File]::WriteAllText($hashPath, "$archiveHash  $archiveName`n", $utf8NoBom)
  $metadataPath = "$archivePath.json"
  Write-JsonFile -Value ([ordered]@{
    archive = $archivePath
    sha256 = $archiveHash
    size_bytes = (Get-Item -LiteralPath $archivePath).Length
    version_id = $versionId
    dataset_sha256 = [string]$manifest.dataset_sha256
    record_count = [int]$manifest.record_count
    node_count = [int]$manifest.node_count
  }) -Path $metadataPath

  [pscustomobject]@{
    Archive = $archivePath
    Sha256 = $archiveHash
    SizeMB = [math]::Round((Get-Item -LiteralPath $archivePath).Length / 1MB, 2)
    VersionId = $versionId
    Records = [int]$manifest.record_count
    Nodes = [int]$manifest.node_count
  } | Format-List
} finally {
  if ($temporaryArchive -and (Test-Path -LiteralPath $temporaryArchive)) {
    Remove-Item -LiteralPath $temporaryArchive -Force
  }
  if (Test-Path -LiteralPath $stage) {
    $resolvedStage = [System.IO.Path]::GetFullPath($stage)
    if (-not $resolvedStage.StartsWith($output + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to clean a staging directory outside the output directory."
    }
    Remove-Item -LiteralPath $resolvedStage -Recurse -Force
  }
}
