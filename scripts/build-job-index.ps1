$ErrorActionPreference = "Stop"

$environmentPath = if ($env:JOB_RAG_ENV_PATH) { $env:JOB_RAG_ENV_PATH } else { "D:\conda_envs\kongming-rag" }
$pythonPath = Join-Path $environmentPath "python.exe"
$dataPath = if ($env:JOB_RAG_DATA_PATH) { $env:JOB_RAG_DATA_PATH } else { "D:\Kongming-RAG\jobs-v1\jobs-500.jsonl" }
$indexRoot = if ($env:JOB_RAG_INDEX_ROOT) { $env:JOB_RAG_INDEX_ROOT } else { "D:\Kongming-RAG\jobs-v1\index" }
$qdrantPath = if ($env:JOB_RAG_QDRANT_PATH) { $env:JOB_RAG_QDRANT_PATH } else { "D:\Kongming-RAG\jobs-v1\database\qdrant" }
$huggingFaceHome = if ($env:HF_HOME) { $env:HF_HOME } else { "D:\ai_models\huggingface" }

if (-not (Test-Path -LiteralPath $pythonPath)) {
  throw "RAG Python environment was not found. Run npm run setup:rag first."
}
if (-not (Test-Path -LiteralPath $dataPath)) {
  throw "Job dataset was not found: $dataPath"
}

$env:HF_HOME = $huggingFaceHome
$env:HF_HUB_CACHE = Join-Path $huggingFaceHome "hub"
$env:JOB_RAG_DATA_PATH = $dataPath
$env:JOB_RAG_INDEX_ROOT = $indexRoot
$env:JOB_RAG_QDRANT_PATH = $qdrantPath
$env:JOB_RAG_JIEBA_CACHE = Join-Path $indexRoot "cache\jieba"
$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
$env:TOKENIZERS_PARALLELISM = "false"

& $pythonPath (Join-Path $PSScriptRoot "..\server\job_knowledge_worker.py") --build
