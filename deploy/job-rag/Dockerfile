FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONUTF8=1 \
    TOKENIZERS_PARALLELISM=false \
    HF_HOME=/models/huggingface \
    HF_HUB_CACHE=/models/huggingface/hub \
    JOB_RAG_DATA_PATH=/data/jobs-v1/jobs-500.jsonl \
    JOB_RAG_INDEX_ROOT=/data/jobs-v1/index \
    JOB_RAG_QDRANT_PATH=/data/jobs-v1/database/qdrant \
    JOB_RAG_RERANK_ENABLED=false \
    PORT=8080

WORKDIR /app

COPY scripts/rag-requirements.txt /app/scripts/rag-requirements.txt
RUN python -m pip install --no-cache-dir -r /app/scripts/rag-requirements.txt

COPY server /app/server

EXPOSE 8080
VOLUME ["/data", "/models"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','8080'), timeout=4)"

CMD ["python", "-u", "/app/server/job_rag_http_service.py"]
