$ErrorActionPreference = "Stop"

$environmentPath = if ($env:OCR_ENV_PATH) { $env:OCR_ENV_PATH } else { "D:\conda_envs\kongming-ocr" }
$pipCache = if ($env:OCR_PIP_CACHE) { $env:OCR_PIP_CACHE } else { "D:\codex_mem\pip-cache" }

if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
  throw "Conda was not found. Install Miniconda or Anaconda first."
}

if (-not (Test-Path -LiteralPath (Split-Path -Parent $environmentPath))) {
  New-Item -ItemType Directory -Path (Split-Path -Parent $environmentPath) -Force | Out-Null
}

if (-not (Test-Path -LiteralPath (Join-Path $environmentPath "python.exe"))) {
  conda create -y -p $environmentPath python=3.11 pip
}

$env:PIP_CACHE_DIR = $pipCache
& (Join-Path $environmentPath "python.exe") -m pip install -r (Join-Path $PSScriptRoot "ocr-requirements.txt")
Write-Output "OCR environment is ready: $environmentPath"
