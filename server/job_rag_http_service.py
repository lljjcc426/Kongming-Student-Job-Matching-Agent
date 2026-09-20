import hmac
import json
import os
import sys
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from job_knowledge_worker import JobKnowledgeBase


MAX_REQUEST_BYTES = 64 * 1024
SERVICE_HOST = os.environ.get("JOB_RAG_SERVICE_HOST", "0.0.0.0")
SERVICE_PORT = int(os.environ.get("PORT", os.environ.get("JOB_RAG_SERVICE_PORT", "8080")))
SERVICE_TOKEN = os.environ.get("JOB_RAG_SERVICE_TOKEN", "").strip()
ALLOW_UNAUTHENTICATED = (
    os.environ.get("JOB_RAG_SERVICE_ALLOW_UNAUTHENTICATED", "false").lower()
    == "true"
)


def _public_status(result):
    manifest = result.get("manifest") or {}
    database = result.get("database") or {}
    reranker = result.get("reranker") or {}
    return {
        "ready": result.get("ready") is True,
        "loaded": result.get("loaded") is True,
        "stale": result.get("stale") is True,
        "manifest": {
            "schema_version": manifest.get("schema_version"),
            "version_id": manifest.get("version_id"),
            "record_count": int(manifest.get("record_count") or 0),
            "node_count": int(manifest.get("node_count") or 0),
            "nodes_per_record": int(manifest.get("nodes_per_record") or 0),
            "index_strategy": manifest.get("index_strategy"),
            "embedding_model": manifest.get("embedding_model"),
            "vector_backend": manifest.get("vector_backend"),
            "built_at": manifest.get("built_at"),
        },
        "database": {
            "type": database.get("type"),
            "backend": database.get("backend"),
            "collection": database.get("collection"),
            "ready": database.get("ready") is True,
            "pointsCount": int(database.get("pointsCount") or 0),
            "expectedPointsCount": int(
                database.get("expectedPointsCount") or 0
            ),
            "recordCount": int(database.get("recordCount") or 0),
            "nodesPerRecord": int(database.get("nodesPerRecord") or 0),
            "storesFullJobPayload": (
                database.get("storesFullJobPayload") is True
            ),
        },
        "cache": result.get("cache"),
        "reranker": {
            "configured": reranker.get("configured") is True,
            "loaded": reranker.get("loaded") is True,
            "model": reranker.get("model"),
            "localModelAvailable": (
                reranker.get("localModelAvailable") is True
            ),
            "device": reranker.get("device"),
            "topN": int(reranker.get("topN") or 0),
            "maxLength": int(reranker.get("maxLength") or 0),
            "localFilesOnly": reranker.get("localFilesOnly") is True,
            "error": (
                "RERANKER_UNAVAILABLE" if reranker.get("error") else None
            ),
        },
        "loaded_at": result.get("loaded_at"),
        "error": "RAG_UNAVAILABLE" if result.get("error") else None,
    }


def _public_search(result):
    diagnostics = dict(result.get("retrievalDiagnostics") or {})
    diagnostics["rerankerSource"] = None
    diagnostics["rerankerError"] = (
        "RERANKER_UNAVAILABLE" if diagnostics.get("rerankerError") else None
    )
    return {**result, "retrievalDiagnostics": diagnostics}


def _authorized(header_value):
    if not SERVICE_TOKEN:
        return ALLOW_UNAUTHENTICATED
    prefix = "Bearer "
    if not isinstance(header_value, str) or not header_value.startswith(prefix):
        return False
    return hmac.compare_digest(header_value[len(prefix):], SERVICE_TOKEN)


class JobRagHandler(BaseHTTPRequestHandler):
    knowledge_base = JobKnowledgeBase()
    knowledge_lock = threading.Lock()
    server_version = "KongmingJobRAG/1.0"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def _headers(self, status, content_length):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(content_length))
        self.send_header("Cache-Control", "no-store, private")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        request_id = self.headers.get("X-Kongming-Request-Id", "")[:80]
        if request_id:
            self.send_header("X-Kongming-Request-Id", request_id)
        self.end_headers()

    def _json(self, status, payload):
        body = json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        self._headers(status, len(body))
        self.wfile.write(body)

    def _authenticate(self):
        if _authorized(self.headers.get("Authorization")):
            return True
        self._json(
            401,
            {"ok": False, "ready": False, "code": "UNAUTHORIZED", "error": "未授权。"},
        )
        return False

    def _status(self):
        with self.knowledge_lock:
            result = self.knowledge_base.status()
        public_result = _public_status(result)
        ready = public_result["ready"]
        self._json(200 if ready else 503, {"ok": ready, **public_result})

    def do_GET(self):
        if self.path not in ("/health", "/api/jobs/status", "/api/jobs/search"):
            self._json(404, {"ok": False, "error": "接口不存在。"})
            return
        if self.path == "/health":
            with self.knowledge_lock:
                ready = self.knowledge_base.status().get("ready") is True
            self._json(200 if ready else 503, {"ok": ready, "ready": ready})
            return
        if not self._authenticate():
            return
        self._status()

    def do_POST(self):
        if self.path != "/api/jobs/search":
            self._json(404, {"ok": False, "error": "接口不存在。"})
            return
        if not self._authenticate():
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self._json(
                413 if content_length > MAX_REQUEST_BYTES else 400,
                {"ok": False, "error": "岗位检索请求大小不正确。"},
            )
            return
        try:
            body = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(body, dict):
                raise ValueError("请求体必须是 JSON 对象")
            with self.knowledge_lock:
                result = self.knowledge_base.search(body)
            self._json(200, {"ok": True, **_public_search(result)})
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
            self._json(400, {"ok": False, "error": "岗位检索请求格式不正确。"})
        except Exception:
            traceback.print_exc(file=sys.stderr)
            self._json(
                503,
                {
                    "ok": False,
                    "code": "RAG_UNAVAILABLE",
                    "error": "岗位知识库暂时不可用。",
                },
            )

    def log_message(self, message_format, *arguments):
        sys.stderr.write(
            "[job-rag-service] " + message_format % arguments + "\n"
        )


def main():
    if not SERVICE_TOKEN and not ALLOW_UNAUTHENTICATED:
        raise RuntimeError(
            "必须设置 JOB_RAG_SERVICE_TOKEN；仅本地调试可显式允许未认证访问"
        )
    try:
        JobRagHandler.knowledge_base.warmup()
        print("[job-rag-service] 岗位知识库预热完成", file=sys.stderr)
    except Exception:
        traceback.print_exc(file=sys.stderr)
        print("[job-rag-service] 预热失败，服务将以未就绪状态启动", file=sys.stderr)

    server = ThreadingHTTPServer((SERVICE_HOST, SERVICE_PORT), JobRagHandler)
    print(
        f"[job-rag-service] listening on {SERVICE_HOST}:{SERVICE_PORT}",
        file=sys.stderr,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        JobRagHandler.knowledge_base.close()


if __name__ == "__main__":
    main()
