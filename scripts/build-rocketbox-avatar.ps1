param(
  [string]$Fbx2GltfPath = $env:FBX2GLTF,
  [string]$AvatarId = 'Business_Female_04',
  [string]$OutputName = 'professional-interviewer-v5.glb'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$avatarSlug = $AvatarId.ToLowerInvariant().Replace('_', '-')
$sourceFileName = "${AvatarId}_facial.fbx"
$assetRoot = Join-Path $repoRoot "scripts\assets\rocketbox-$avatarSlug"
$buildRoot = Join-Path $repoRoot "tmp\avatar-build\rocketbox-$avatarSlug"
$rawModel = Join-Path $buildRoot "$avatarSlug-facial.glb"
$preparedModel = Join-Path $buildRoot "$([System.IO.Path]::GetFileNameWithoutExtension($OutputName))-prepared.glb"
$outputModel = Join-Path $repoRoot "harmony\entry\src\main\resources\rawfile\avatar\$OutputName"

if (-not $Fbx2GltfPath) {
  $command = Get-Command 'FBX2glTF' -ErrorAction SilentlyContinue
  if ($command) {
    $Fbx2GltfPath = $command.Source
  } else {
    $Fbx2GltfPath = Join-Path $repoRoot '..\tools\FBX2glTF-v0.9.7\FBX2glTF-windows-x64.exe'
  }
}

if (-not (Test-Path -LiteralPath $Fbx2GltfPath)) {
  throw "FBX2glTF was not found. Set FBX2GLTF or pass -Fbx2GltfPath. Expected: $Fbx2GltfPath"
}

New-Item -ItemType Directory -Force -Path $buildRoot | Out-Null
$sourceModel = Join-Path $assetRoot $sourceFileName
$rawOutputWithoutExtension = [System.IO.Path]::Combine($buildRoot, "$avatarSlug-facial")

if (-not (Test-Path -LiteralPath $sourceModel)) {
  throw "Rocketbox facial source was not found: $sourceModel"
}

& $Fbx2GltfPath `
  --input $sourceModel `
  --output $rawOutputWithoutExtension `
  --binary `
  --pbr-metallic-roughness `
  --compute-normals broken `
  --blend-shape-normals `
  --blend-shape-tangents `
  --fbx-temp-dir $buildRoot
if ($LASTEXITCODE -ne 0) { throw "FBX2glTF failed with exit code $LASTEXITCODE." }

node (Join-Path $repoRoot 'scripts\prepare-rocketbox-avatar.cjs') `
  $rawModel `
  $sourceModel `
  $assetRoot `
  $preparedModel
if ($LASTEXITCODE -ne 0) { throw 'Rocketbox avatar preparation failed.' }

node (Join-Path $repoRoot 'scripts\build-avatar-lipsync.cjs') `
  $preparedModel `
  $outputModel `
  --runtime-morphs
if ($LASTEXITCODE -ne 0) { throw 'HarmonyOS morph compatibility preparation failed.' }

node (Join-Path $repoRoot 'scripts\inspect-avatar-glb.cjs') $outputModel
if ($LASTEXITCODE -ne 0) { throw 'Avatar inspection failed.' }

Write-Output "Rocketbox interviewer $AvatarId written to $outputModel"
