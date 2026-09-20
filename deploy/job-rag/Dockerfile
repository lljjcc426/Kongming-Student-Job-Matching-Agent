FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONUTF8=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TOKENIZERS_PARALLELISM=false \
    HF_HOME=/models/huggingface \
    HF_HUB_CACHE=/models/huggingface/hub \
    JOB_RAG_DATA_PATH=/data/jobs-v1/jobs-500.jsonl \
    JOB_RAG_INDEX_ROOT=/data/jobs-v1/index \
    JOB_RAG_QDRANT_PATH=/data/jobs-v1/database/qdrant \
    JOB_RAG_EMBED_MODEL=/models/huggingface/bge-small-zh-v1.5 \
    JOB_RAG_BOOTSTRAP_REQUIRED=true \
    JOB_RAG_RERANK_ENABLED=false \
    PORT=8080

WORKDIR /app

COPY scripts/rag-requirements.txt /app/scripts/rag-requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir --retries 10 \
      --index-url https://download.pytorch.org/whl/cpu \
      torch==2.13.0+cpu \
    && python -m pip install --no-cache-dir --retries 10 \
      -r /app/scripts/rag-requirements.txt

ARG JOB_RAG_EMBED_MODEL_REVISION=7999e1d3359715c523056ef9478215996d62a620
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download(repo_id='BAAI/bge-small-zh-v1.5', revision='${JOB_RAG_EMBED_MODEL_REVISION}', local_dir='/models/huggingface/bge-small-zh-v1.5')"

ENV JOB_RAG_RERANK_MODEL_PATH=/models/kongming-rerankers/bge-reranker-v2-m3

COPY server /app/server

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','8080'), timeout=4)"

CMD ["python", "-u", "/app/server/job_rag_bootstrap.py"]
