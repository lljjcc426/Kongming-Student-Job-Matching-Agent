$ErrorActionPreference = "Stop"

$environmentPath = if ($env:JOB_RAG_ENV_PATH) { $env:JOB_RAG_ENV_PATH } else { "D:\conda_envs\kongming-rag" }
$pythonPath = Join-Path $environmentPath "python.exe"
$huggingFaceHome = if ($env:HF_HOME) { $env:HF_HOME } else { "D:\ai_models\huggingface" }
$modelName = if ($env:JOB_RAG_RERANK_MODEL) { $env:JOB_RAG_RERANK_MODEL } else { "BAAI/bge-reranker-v2-m3" }
$modelPath = if ($env:JOB_RAG_RERANK_MODEL_PATH) { $env:JOB_RAG_RERANK_MODEL_PATH } else { "D:\ai_models\kongming-rerankers\bge-reranker-v2-m3" }
$reportPath = if ($env:JOB_RAG_RERANK_CACHE_REPORT_PATH) { $env:JOB_RAG_RERANK_CACHE_REPORT_PATH } else { "D:\Kongming-RAG\jobs-v1\index\reranker-cache-verification.json" }

if (-not (Test-Path -LiteralPath $pythonPath)) {
  throw "RAG Python environment was not found. Run npm run setup:rag first."
}

$env:HF_HOME = $huggingFaceHome
$env:HF_HUB_CACHE = Join-Path $huggingFaceHome "hub"
$env:HF_HUB_DISABLE_XET = "1"
$env:TOKENIZERS_PARALLELISM = "false"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

& $pythonPath (Join-Path $PSScriptRoot "cache_job_reranker.py") `
  --model $modelName `
  --target $modelPath `
  --report $reportPath

if ($LASTEXITCODE -ne 0) {
  throw "Failed to cache or verify reranker model: $modelName"
}

Write-Output "Reranker model is ready: $modelPath"
Write-Output "Verification report: $reportPath"
