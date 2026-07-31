$ErrorActionPreference = "Stop"

$environmentPath = if ($env:JOB_RAG_ENV_PATH) { $env:JOB_RAG_ENV_PATH } else { "D:\conda_envs\kongming-rag" }
$pipCache = if ($env:JOB_RAG_PIP_CACHE) { $env:JOB_RAG_PIP_CACHE } else { "D:\codex_mem\pip-cache" }
$pipIndex = if ($env:JOB_RAG_PIP_INDEX) { $env:JOB_RAG_PIP_INDEX } else { "https://pypi.org/simple" }
$huggingFaceHome = if ($env:HF_HOME) { $env:HF_HOME } else { "D:\ai_models\huggingface" }

if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
  throw "Conda was not found. Install Miniconda or Anaconda first."
}

$environmentParent = Split-Path -Parent $environmentPath
if (-not (Test-Path -LiteralPath $environmentParent)) {
  New-Item -ItemType Directory -Path $environmentParent -Force | Out-Null
}
if (-not (Test-Path -LiteralPath $pipCache)) {
  New-Item -ItemType Directory -Path $pipCache -Force | Out-Null
}
if (-not (Test-Path -LiteralPath $huggingFaceHome)) {
  New-Item -ItemType Directory -Path $huggingFaceHome -Force | Out-Null
}

if (-not (Test-Path -LiteralPath (Join-Path $environmentPath "python.exe"))) {
  conda create -y -p $environmentPath python=3.11 pip
}

$env:PIP_CACHE_DIR = $pipCache
$env:HF_HOME = $huggingFaceHome
$env:HF_HUB_CACHE = Join-Path $huggingFaceHome "hub"

$pythonPath = Join-Path $environmentPath "python.exe"
& $pythonPath -m pip install --index-url $pipIndex --upgrade pip
if ($LASTEXITCODE -ne 0) {
  throw "Failed to upgrade pip from $pipIndex"
}
& $pythonPath -m pip install --index-url $pipIndex -r (Join-Path $PSScriptRoot "rag-requirements.txt")
if ($LASTEXITCODE -ne 0) {
  throw "Failed to install RAG dependencies from $pipIndex"
}

Write-Output "RAG environment is ready: $environmentPath"
Write-Output "Hugging Face cache: $huggingFaceHome"
