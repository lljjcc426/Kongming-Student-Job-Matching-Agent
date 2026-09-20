import argparse
import copy
import contextlib
import hashlib
import json
import math
import os
import re
import sys
import time
import traceback
import uuid
from collections import Counter, OrderedDict
from pathlib import Path


DEFAULT_DATA_PATH = Path(r"D:\Kongming-RAG\jobs-v1\jobs-500.jsonl")
DEFAULT_INDEX_ROOT = Path(r"D:\Kongming-RAG\jobs-v1\index")
DEFAULT_QDRANT_PATH = Path(r"D:\Kongming-RAG\jobs-v1\database\qdrant")
DEFAULT_MODEL_NAME = "BAAI/bge-small-zh-v1.5"
DEFAULT_MODEL_CACHE = Path(r"D:\ai_models\huggingface")
DEFAULT_RERANK_MODEL = "BAAI/bge-reranker-v2-m3"
DEFAULT_RERANK_MODEL_PATH = Path(
    r"D:\ai_models\kongming-rerankers\bge-reranker-v2-m3"
)
QUERY_INSTRUCTION = "为这个句子生成表示以用于检索相关文章："
SCHEMA_VERSION = "1.2"
VECTOR_BACKEND = "qdrant-local"
INDEX_STRATEGY = "job-sections-v1"
NODE_SECTIONS = ("overview", "responsibilities", "requirements")
RRF_K = 60
_JIEBA_CONFIGURED = False

STOP_WORDS = {
    "的",
    "了",
    "和",
    "与",
    "及",
    "或",
    "在",
    "有",
    "是",
    "为",
    "等",
    "我",
    "想",
    "希望",
    "岗位",
    "职位",
    "工作",
    "招聘",
    "相关",
    "负责",
    "要求",
    "熟悉",
    "具备",
    "优先",
}


def _configure_cache():
    hugging_face_home = Path(os.environ.get("HF_HOME", DEFAULT_MODEL_CACHE))
    os.environ.setdefault("HF_HOME", str(hugging_face_home))
    os.environ.setdefault("HF_HUB_CACHE", str(hugging_face_home / "hub"))
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


_configure_cache()


def _data_path():
    return Path(os.environ.get("JOB_RAG_DATA_PATH", DEFAULT_DATA_PATH))


def _index_root():
    return Path(os.environ.get("JOB_RAG_INDEX_ROOT", DEFAULT_INDEX_ROOT))


def _qdrant_path():
    return Path(os.environ.get("JOB_RAG_QDRANT_PATH", DEFAULT_QDRANT_PATH))


def _manifest_qdrant_path(database):
    configured_path = os.environ.get("JOB_RAG_QDRANT_PATH")
    return Path(configured_path or database.get("path") or _qdrant_path())


def _model_name():
    return os.environ.get("JOB_RAG_EMBED_MODEL", DEFAULT_MODEL_NAME)


def _model_cache():
    return Path(os.environ.get("HF_HOME", DEFAULT_MODEL_CACHE))


def _reranker_model_name():
    return os.environ.get(
        "JOB_RAG_RERANK_MODEL",
        DEFAULT_RERANK_MODEL,
    )


def _reranker_model_path():
    return Path(
        os.environ.get(
            "JOB_RAG_RERANK_MODEL_PATH",
            DEFAULT_RERANK_MODEL_PATH,
        )
    )


def _reranker_source():
    model_path = _reranker_model_path()
    if model_path.is_dir() or os.environ.get("JOB_RAG_RERANK_MODEL_PATH"):
        return str(model_path)
    return _reranker_model_name()


def _reranker_model_available():
    model_path = _reranker_model_path()
    required_files = (
        model_path / "config.json",
        model_path / "model.safetensors",
        model_path / "tokenizer_config.json",
    )
    tokenizer_available = any(
        (model_path / file_name).is_file()
        for file_name in ("tokenizer.json", "sentencepiece.bpe.model")
    )
    return all(file_path.is_file() for file_path in required_files) and tokenizer_available


def _reranker_enabled():
    return _env_bool(
        "JOB_RAG_RERANK_ENABLED",
        _reranker_model_available(),
    )


def _reranker_top_n():
    return _env_int(
        "JOB_RAG_RERANK_TOP_N",
        8,
        minimum=1,
        maximum=30,
    )


def _reranker_max_length():
    return _env_int(
        "JOB_RAG_RERANK_MAX_LENGTH",
        384,
        minimum=128,
        maximum=2048,
    )


def _env_bool(name, default=False):
    raw_value = os.environ.get(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name, default, minimum=0, maximum=None):
    try:
        value = int(os.environ.get(name, default))
    except (TypeError, ValueError):
        value = default
    value = max(minimum, value)
    return min(value, maximum) if maximum is not None else value


def _sha256_file(file_path):
    digest = hashlib.sha256()
    with file_path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _atomic_json(file_path, payload):
    file_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = file_path.with_suffix(file_path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary_path, file_path)


def _read_json(file_path):
    return json.loads(file_path.read_text(encoding="utf-8"))


def _load_records(data_path):
    records = []
    with data_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"岗位数据第 {line_number} 行不是有效 JSON：{error}") from error
            if not record.get("id") or not record.get("retrieval_text"):
                raise ValueError(f"岗位数据第 {line_number} 行缺少 id 或 retrieval_text")
            records.append(record)
    if not records:
        raise ValueError("岗位数据集为空")
    return records


def _compact_text(value, limit=160):
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit]


def _budgeted_items(items, budget=280):
    values = [_compact_text(item, 240) for item in items if _compact_text(item, 240)]
    if not values:
        return ""
    separator_size = max(0, len(values) - 1)
    item_limit = max(24, (budget - separator_size) // len(values))
    return "；".join(_compact_text(item, item_limit) for item in values)


def _job_heading(job):
    sections = [
        f"职位：{_compact_text(job.get('title'), 64)}",
        f"公司：{_compact_text(job.get('company_name'), 24)}",
        f"招聘类型：{_compact_text(job.get('recruitment_type'), 16)}",
        f"地点：{_compact_text(job.get('city'), 40)}",
        f"岗位类别：{_compact_text(job.get('job_family'), 32)}",
    ]
    return "\n".join(
        section for section in sections if section.split("：", 1)[-1].strip()
    )


def _embedding_sections(job):
    heading = _job_heading(job)
    skills = _budgeted_items(job.get("skills") or [], 150)
    overview_details = [
        f"部门：{_compact_text(job.get('department'), 50)}",
        f"技能：{skills}",
        f"学历：{_compact_text(job.get('education_requirement'), 80)}",
        f"经验：{_compact_text(job.get('experience_requirement'), 80)}",
    ]
    overview = "\n".join(
        ["岗位概览", heading]
        + [
            section
            for section in overview_details
            if section.split("：", 1)[-1].strip()
        ]
    )

    responsibilities = _budgeted_items(
        job.get("responsibilities") or [],
        250,
    )
    responsibility_text = "\n".join(
        ["岗位职责", heading, responsibilities or "未提供明确岗位职责"]
    )

    requirement_items = [
        *(job.get("requirements") or []),
        *(f"优先条件：{item}" for item in (job.get("preferred_qualifications") or [])),
    ]
    requirements = _budgeted_items(requirement_items, 250)
    requirement_text = "\n".join(
        ["任职要求", heading, requirements or "未提供明确任职要求"]
    )

    return (
        ("overview", overview),
        ("responsibilities", responsibility_text),
        ("requirements", requirement_text),
    )


def _job_node_id(job_id, section=None):
    suffix = f":{section}" if section else ""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"kongming-job:{job_id}{suffix}"))


def _rerank_text(job):
    sections = [
        f"职位：{_compact_text(job.get('title'), 64)}",
        f"公司：{_compact_text(job.get('company_name'), 20)}",
        f"地点：{_compact_text(job.get('city'), 24)}",
        f"岗位类别：{_compact_text(job.get('job_family'), 32)}",
        f"技能：{_budgeted_items(job.get('skills') or [], 80)}",
        (
            "职责："
            + _budgeted_items(job.get("responsibilities") or [], 80)
        ),
        (
            "要求："
            + _budgeted_items(
                [
                    *(job.get("requirements") or []),
                    *(job.get("preferred_qualifications") or []),
                ],
                80,
            )
        ),
    ]
    return "\n".join(
        section for section in sections if section.split("：", 1)[-1].strip()
    )


def _tokenize(text):
    global _JIEBA_CONFIGURED
    import jieba

    if not _JIEBA_CONFIGURED:
        cache_dir = Path(
            os.environ.get(
                "JOB_RAG_JIEBA_CACHE",
                str(_index_root() / "cache" / "jieba"),
            )
        )
        cache_dir.mkdir(parents=True, exist_ok=True)
        jieba.dt.tmp_dir = str(cache_dir)
        jieba.dt.cache_file = "jieba.cache"
        _JIEBA_CONFIGURED = True

    normalized = str(text or "").lower()
    chinese_and_words = re.sub(r"[^\u4e00-\u9fffa-z0-9+#.]+", " ", normalized)
    jieba_tokens = [
        token.strip()
        for token in jieba.lcut(chinese_and_words, cut_all=False)
        if token.strip()
    ]
    english_tokens = re.findall(r"[a-z][a-z0-9+#.]{1,30}", normalized)
    tokens = []
    for token in [*jieba_tokens, *english_tokens]:
        compact = token.strip(" .")
        if not compact or compact in STOP_WORDS:
            continue
        if len(compact) == 1 and not re.fullmatch(r"[a-z0-9+#]", compact):
            continue
        tokens.append(compact)
    return tokens


def _build_lexical_index(records):
    tokens_by_id = {}
    document_frequency = Counter()
    document_lengths = {}
    for job in records:
        search_text = " ".join(
            [
                str(job.get("title", "")),
                str(job.get("title", "")),
                str(job.get("company_name", "")),
                str(job.get("city", "")),
                str(job.get("job_family", "")),
                " ".join(job.get("skills") or []),
                str(job.get("retrieval_text", "")),
            ]
        )
        tokens = _tokenize(search_text)
        tokens_by_id[job["id"]] = tokens
        document_lengths[job["id"]] = len(tokens)
        document_frequency.update(set(tokens))
    average_length = (
        sum(document_lengths.values()) / len(document_lengths)
        if document_lengths
        else 0
    )
    return {
        "schema_version": SCHEMA_VERSION,
        "document_count": len(records),
        "average_document_length": average_length,
        "document_frequency": dict(document_frequency),
        "document_lengths": document_lengths,
        "tokens_by_id": tokens_by_id,
    }


def _make_embed_model():
    try:
        from llama_index.embeddings.huggingface import HuggingFaceEmbedding
    except ImportError as error:
        raise RuntimeError(
            "缺少 RAG 依赖，请先在项目目录运行 npm run setup:rag"
        ) from error

    device = os.environ.get("JOB_RAG_DEVICE", "cpu")
    return HuggingFaceEmbedding(
        model_name=_model_name(),
        cache_folder=str(_model_cache()),
        device=device,
        max_length=512,
        normalize=True,
        query_instruction=QUERY_INSTRUCTION,
        embed_batch_size=int(os.environ.get("JOB_RAG_EMBED_BATCH_SIZE", "32")),
    )


def _inspect_qdrant(manifest, client=None):
    database = manifest.get("database") or {}
    database_path = _manifest_qdrant_path(database)
    collection_name = database.get("collection")
    record_count = int(manifest.get("record_count") or 0)
    node_count = int(manifest.get("node_count") or record_count)
    nodes_per_record = int(manifest.get("nodes_per_record") or 1)
    result = {
        "type": "Qdrant Local",
        "backend": manifest.get("vector_backend"),
        "path": str(database_path),
        "collection": collection_name,
        "ready": False,
        "pointsCount": 0,
        "expectedPointsCount": node_count,
        "recordCount": record_count,
        "nodesPerRecord": nodes_per_record,
        "storesFullJobPayload": False,
    }
    if manifest.get("vector_backend") != VECTOR_BACKEND:
        result["error"] = "当前活动索引不是 Qdrant 本地数据库"
        return result
    if not collection_name:
        result["error"] = "索引清单缺少 Qdrant 集合名称"
        return result
    if not database_path.exists():
        result["error"] = f"Qdrant 数据库目录不存在：{database_path}"
        return result

    owns_client = client is None
    try:
        if owns_client:
            from qdrant_client import QdrantClient

            client = QdrantClient(path=str(database_path))
        if not client.collection_exists(collection_name):
            result["error"] = f"Qdrant 集合不存在：{collection_name}"
            return result

        result["pointsCount"] = int(
            client.count(collection_name=collection_name, exact=True).count
        )
        points, _ = client.scroll(
            collection_name=collection_name,
            limit=1,
            with_payload=True,
            with_vectors=False,
        )
        if points:
            payload = points[0].payload or {}
            full_job = payload.get("job_json")
            if isinstance(full_job, str):
                try:
                    full_job = json.loads(full_job)
                except json.JSONDecodeError:
                    full_job = None
            result["storesFullJobPayload"] = bool(
                isinstance(full_job, dict) and full_job.get("id")
            )
        result["ready"] = (
            result["pointsCount"] == node_count
            and result["storesFullJobPayload"]
        )
        if not result["ready"]:
            result["error"] = (
                "Qdrant 数据量或完整岗位元数据与索引清单不一致"
            )
        return result
    except Exception as error:
        result["error"] = str(error)
        return result
    finally:
        if owns_client and client is not None:
            client.close()


def build_index(force=False):
    data_path = _data_path()
    index_root = _index_root()
    qdrant_path = _qdrant_path()
    if not data_path.exists():
        raise FileNotFoundError(f"岗位数据集不存在：{data_path}")
    if os.name == "nt" and data_path.drive.upper() != "D:":
        raise ValueError(f"岗位数据必须位于 D 盘：{data_path}")
    if os.name == "nt" and index_root.drive.upper() != "D:":
        raise ValueError(f"岗位索引必须位于 D 盘：{index_root}")
    if os.name == "nt" and qdrant_path.drive.upper() != "D:":
        raise ValueError(f"Qdrant 数据库必须位于 D 盘：{qdrant_path}")

    started_at = time.perf_counter()
    dataset_hash = _sha256_file(data_path)
    model_name = _model_name()
    model_hash = hashlib.sha256(model_name.encode("utf-8")).hexdigest()[:8]
    version_id = f"{dataset_hash[:12]}-{model_hash}-qdrant-sections-v1"
    collection_name = (
        f"kongming_jobs_{dataset_hash[:12]}_{model_hash}_sections_v1"
    )
    version_dir = index_root / "versions" / version_id
    manifest_path = version_dir / "manifest.json"
    pointer_path = index_root / "active-index.json"

    if manifest_path.exists() and not force:
        manifest = _read_json(manifest_path)
        database_status = _inspect_qdrant(manifest)
        if database_status["ready"]:
            _atomic_json(
                pointer_path,
                {
                    "version_id": version_id,
                    "version_dir": str(version_dir),
                    "activated_at": time.strftime(
                        "%Y-%m-%dT%H:%M:%SZ", time.gmtime()
                    ),
                },
            )
            return {
                **manifest,
                "database_status": database_status,
                "reused": True,
            }

    records = _load_records(data_path)
    try:
        from llama_index.core import StorageContext, VectorStoreIndex
        from llama_index.core.schema import TextNode
        from llama_index.vector_stores.qdrant import QdrantVectorStore
        from qdrant_client import QdrantClient
    except ImportError as error:
        raise RuntimeError(
            "缺少 LlamaIndex 或 Qdrant，请先在项目目录运行 npm run setup:rag"
        ) from error

    nodes = []
    for job in records:
        shared_metadata = {
            "job_id": job["id"],
            "source": job.get("source", ""),
            "source_name": job.get("source_name", ""),
            "company_name": job.get("company_name", ""),
            "title": job.get("title", ""),
            "city": job.get("city", ""),
            "recruitment_type": job.get("recruitment_type", ""),
            "job_family": job.get("job_family", ""),
            "skills": "、".join(job.get("skills") or []),
            "source_url": job.get("source_url", ""),
            "last_verified_at": job.get("last_verified_at", ""),
            "job_json": json.dumps(
                job,
                ensure_ascii=False,
                separators=(",", ":"),
            ),
        }
        for section_type, section_text in _embedding_sections(job):
            metadata = {
                **shared_metadata,
                "section_type": section_type,
            }
            metadata_keys = list(metadata.keys())
            nodes.append(
                TextNode(
                    id_=_job_node_id(job["id"], section_type),
                    text=section_text,
                    metadata=metadata,
                    excluded_embed_metadata_keys=metadata_keys,
                    excluded_llm_metadata_keys=metadata_keys,
                )
            )

    version_dir.mkdir(parents=True, exist_ok=True)
    qdrant_path.mkdir(parents=True, exist_ok=True)
    qdrant_client = QdrantClient(path=str(qdrant_path))
    try:
        vector_store = QdrantVectorStore(
            client=qdrant_client,
            collection_name=collection_name,
            batch_size=64,
            index_doc_id=False,
        )
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        with contextlib.redirect_stdout(sys.stderr):
            embed_model = _make_embed_model()
            VectorStoreIndex(
                nodes,
                storage_context=storage_context,
                embed_model=embed_model,
                show_progress=True,
            )
        points_count = int(
            qdrant_client.count(
                collection_name=collection_name,
                exact=True,
            ).count
        )
    finally:
        qdrant_client.close()
    if points_count != len(nodes):
        raise RuntimeError(
            f"Qdrant 向量节点数量不完整：{points_count} / {len(nodes)}"
        )

    lexical_index = _build_lexical_index(records)
    _atomic_json(version_dir / "catalog.json", {"jobs": records})
    _atomic_json(version_dir / "lexical-index.json", lexical_index)

    source_counts = Counter(job.get("source_name", "未标注") for job in records)
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "version_id": version_id,
        "dataset_path": str(data_path),
        "dataset_sha256": dataset_hash,
        "record_count": len(records),
        "node_count": len(nodes),
        "nodes_per_record": len(NODE_SECTIONS),
        "node_sections": list(NODE_SECTIONS),
        "index_strategy": INDEX_STRATEGY,
        "embedding_model": model_name,
        "embedding_device": os.environ.get("JOB_RAG_DEVICE", "cpu"),
        "query_instruction": QUERY_INSTRUCTION,
        "vector_backend": VECTOR_BACKEND,
        "database": {
            "type": "Qdrant Local",
            "path": str(qdrant_path),
            "collection": collection_name,
            "points_count": points_count,
            "stores_full_job_payload": True,
        },
        "retrieval": {
            "dense": (
                "LlamaIndex + Qdrant cosine similarity over overview, "
                "responsibilities and requirements nodes; aggregate by job"
            ),
            "lexical": "BM25 with jieba tokenization",
            "fusion": f"weighted reciprocal rank fusion, k={RRF_K}",
        },
        "sources": dict(source_counts),
        "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "build_elapsed_seconds": round(time.perf_counter() - started_at, 3),
        "storage_dir": str(qdrant_path),
    }
    _atomic_json(manifest_path, manifest)
    _atomic_json(
        pointer_path,
        {
            "version_id": version_id,
            "version_dir": str(version_dir),
            "activated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
    )
    return {**manifest, "reused": False}


def _normalize_location(value):
    return (
        str(value or "")
        .lower()
        .replace("特别行政区", "")
        .replace("自治区", "")
        .replace("省", "")
        .replace("市", "")
        .replace(" ", "")
    )


def _string_list(value, limit=20):
    if not isinstance(value, list):
        return []
    return [
        str(item).strip()
        for item in value[:limit]
        if isinstance(item, (str, int, float)) and str(item).strip()
    ]


def _normalize_filters(value):
    value = value if isinstance(value, dict) else {}
    return {
        "sources": _string_list(value.get("sources"), 6),
        "cities": _string_list(value.get("cities"), 12),
        "recruitmentTypes": _string_list(value.get("recruitmentTypes"), 6),
        "jobFamilies": _string_list(value.get("jobFamilies"), 12),
        "skills": _string_list(value.get("skills"), 20),
        "studentOnly": value.get("studentOnly") is True,
    }


def _matches_filters(job, filters):
    if filters["sources"]:
        source_values = {
            str(job.get("source", "")).lower(),
            str(job.get("source_name", "")).lower(),
            str(job.get("company_name", "")).lower(),
        }
        if not any(source.lower() in source_values for source in filters["sources"]):
            return False

    if filters["cities"]:
        job_city = _normalize_location(job.get("city"))
        if not any(_normalize_location(city) in job_city for city in filters["cities"]):
            return False

    recruitment_type = str(job.get("recruitment_type", ""))
    if filters["studentOnly"] and recruitment_type not in {"实习", "校园招聘"}:
        return False
    if filters["recruitmentTypes"] and recruitment_type not in filters["recruitmentTypes"]:
        return False

    if filters["jobFamilies"]:
        family = str(job.get("job_family", "")).lower()
        if not any(value.lower() in family for value in filters["jobFamilies"]):
            return False

    if filters["skills"]:
        job_skills = {str(skill).lower() for skill in job.get("skills") or []}
        if not any(skill.lower() in job_skills for skill in filters["skills"]):
            return False

    return True


def _bm25_scores(query_tokens, lexical_index, candidate_ids):
    document_count = lexical_index["document_count"]
    average_length = lexical_index["average_document_length"] or 1
    document_frequency = lexical_index["document_frequency"]
    document_lengths = lexical_index["document_lengths"]
    tokens_by_id = lexical_index["tokens_by_id"]
    query_frequency = Counter(query_tokens)
    scores = {}
    k1 = 1.5
    b = 0.75

    for job_id in candidate_ids:
        tokens = tokens_by_id.get(job_id, [])
        if not tokens:
            continue
        term_frequency = Counter(tokens)
        document_length = document_lengths.get(job_id, len(tokens))
        score = 0.0
        for token, query_count in query_frequency.items():
            frequency = term_frequency.get(token, 0)
            if frequency <= 0:
                continue
            frequency_in_documents = document_frequency.get(token, 0)
            inverse_document_frequency = math.log(
                1
                + (document_count - frequency_in_documents + 0.5)
                / (frequency_in_documents + 0.5)
            )
            denominator = frequency + k1 * (
                1 - b + b * document_length / average_length
            )
            score += (
                inverse_document_frequency
                * (frequency * (k1 + 1) / denominator)
                * min(query_count, 2)
            )
        if score > 0:
            scores[job_id] = score
    return scores


def _public_job(job):
    keys = [
        "id",
        "source",
        "source_name",
        "source_job_id",
        "source_url",
        "company_name",
        "title",
        "recruitment_type",
        "employment_type",
        "city",
        "department",
        "job_family",
        "responsibilities",
        "requirements",
        "preferred_qualifications",
        "skills",
        "education_requirement",
        "experience_requirement",
        "published_at",
        "refreshed_at",
        "expires_at",
        "last_verified_at",
        "status",
    ]
    return {key: job.get(key) for key in keys}


def _normalize_search_queries(body):
    primary_query = str(body.get("query", "")).strip()
    if len(primary_query) < 2:
        raise ValueError("检索词至少需要 2 个字符")
    raw_queries = [primary_query]
    extra_queries = body.get("queries")
    if isinstance(extra_queries, list):
        raw_queries.extend(extra_queries)

    queries = []
    for value in raw_queries:
        query = str(value or "").strip()
        if len(query) < 2:
            continue
        if len(query) > 2000:
            raise ValueError("单条检索词不能超过 2000 个字符")
        if query not in queries:
            queries.append(query)
        if len(queries) >= 3:
            break
    return primary_query, queries


class JobKnowledgeBase:
    def __init__(self):
        self.index = None
        self.qdrant_client = None
        self.catalog = {}
        self.lexical_index = None
        self.manifest = None
        self.loaded_at = None
        self.search_cache = OrderedDict()
        self.cache_hits = 0
        self.cache_misses = 0
        self.cache_max_entries = _env_int(
            "JOB_RAG_CACHE_MAX_ENTRIES",
            64,
            minimum=0,
            maximum=512,
        )
        self.cache_ttl_seconds = _env_int(
            "JOB_RAG_CACHE_TTL_SECONDS",
            900,
            minimum=0,
            maximum=86400,
        )
        self.reranker = None
        self.reranker_error = None
        self.reranker_loaded_model = None
        self.reranker_loaded_source = None

    def _cache_status(self):
        return {
            "enabled": (
                self.cache_max_entries > 0
                and self.cache_ttl_seconds > 0
            ),
            "entries": len(self.search_cache),
            "maxEntries": self.cache_max_entries,
            "ttlSeconds": self.cache_ttl_seconds,
            "hits": self.cache_hits,
            "misses": self.cache_misses,
        }

    def _reranker_status(self):
        model_path = _reranker_model_path()
        return {
            "configured": _reranker_enabled(),
            "loaded": self.reranker is not None,
            "model": _reranker_model_name(),
            "source": self.reranker_loaded_source or _reranker_source(),
            "modelPath": str(model_path),
            "localModelAvailable": _reranker_model_available(),
            "device": os.environ.get("JOB_RAG_RERANK_DEVICE", "cpu"),
            "topN": _reranker_top_n(),
            "maxLength": _reranker_max_length(),
            "localFilesOnly": _env_bool(
                "JOB_RAG_RERANK_LOCAL_FILES_ONLY",
                True,
            ),
            "error": self.reranker_error,
        }

    def _search_cache_key(self, queries, top_k, filters, rerank_enabled):
        normalized_filters = {
            key: sorted(value) if isinstance(value, list) else value
            for key, value in filters.items()
        }
        payload = {
            "index_version": self.manifest.get("version_id"),
            "queries": queries,
            "top_k": top_k,
            "filters": normalized_filters,
            "rerank": rerank_enabled,
            "rerank_model": (
                _reranker_model_name()
                if rerank_enabled
                else None
            ),
            "rerank_source": _reranker_source() if rerank_enabled else None,
            "rerank_top_n": _reranker_top_n() if rerank_enabled else None,
            "rerank_max_length": (
                _reranker_max_length() if rerank_enabled else None
            ),
        }
        return hashlib.sha256(
            json.dumps(
                payload,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        ).hexdigest()

    def _cache_get(self, cache_key):
        if self.cache_max_entries <= 0 or self.cache_ttl_seconds <= 0:
            return None, 0
        cached = self.search_cache.get(cache_key)
        if cached is None:
            self.cache_misses += 1
            return None, 0
        cached_at, response = cached
        age_seconds = time.monotonic() - cached_at
        if age_seconds > self.cache_ttl_seconds:
            self.search_cache.pop(cache_key, None)
            self.cache_misses += 1
            return None, 0
        self.search_cache.move_to_end(cache_key)
        self.cache_hits += 1
        return copy.deepcopy(response), round(age_seconds * 1000, 2)

    def _cache_put(self, cache_key, response):
        if self.cache_max_entries <= 0 or self.cache_ttl_seconds <= 0:
            return
        self.search_cache[cache_key] = (
            time.monotonic(),
            copy.deepcopy(response),
        )
        self.search_cache.move_to_end(cache_key)
        while len(self.search_cache) > self.cache_max_entries:
            self.search_cache.popitem(last=False)

    def _load_reranker(self):
        if self.reranker is not None:
            return self.reranker
        if self.reranker_error:
            return None
        model_name = _reranker_model_name()
        model_source = _reranker_source()
        try:
            from sentence_transformers import CrossEncoder

            with contextlib.redirect_stdout(sys.stderr):
                self.reranker = CrossEncoder(
                    model_source,
                    device=os.environ.get(
                        "JOB_RAG_RERANK_DEVICE",
                        "cpu",
                    ),
                    local_files_only=_env_bool(
                        "JOB_RAG_RERANK_LOCAL_FILES_ONLY",
                        True,
                    ),
                    max_length=_reranker_max_length(),
                )
            self.reranker_loaded_model = model_name
            self.reranker_loaded_source = model_source
            return self.reranker
        except Exception as error:
            self.reranker_error = str(error)[:500]
            if _env_bool("JOB_RAG_RERANK_STRICT", False):
                raise
            return None

    def _rerank_jobs(self, queries, ranked_ids, top_k, enabled):
        diagnostics = {
            "rerankerEnabled": enabled,
            "rerankerApplied": False,
            "rerankerModel": (
                _reranker_model_name()
                if enabled
                else None
            ),
            "rerankerSource": _reranker_source() if enabled else None,
            "rerankerMaxLength": (
                _reranker_max_length() if enabled else None
            ),
            "rerankCandidates": 0,
            "rerankElapsedMs": 0,
            "rerankerError": None,
        }
        if not enabled or not ranked_ids:
            return ranked_ids, {}, {}, {}, diagnostics

        started_at = time.perf_counter()
        reranker = self._load_reranker()
        if reranker is None:
            diagnostics["rerankElapsedMs"] = round(
                (time.perf_counter() - started_at) * 1000,
                2,
            )
            diagnostics["rerankerError"] = self.reranker_error
            return ranked_ids, {}, {}, {}, diagnostics

        rerank_count = min(
            len(ranked_ids),
            max(
                top_k,
                _reranker_top_n(),
            ),
        )
        rerank_ids = ranked_ids[:rerank_count]
        rerank_query = _budgeted_items(queries, 120)
        pairs = [
            [rerank_query, _rerank_text(self.catalog[job_id])]
            for job_id in rerank_ids
        ]
        with contextlib.redirect_stdout(sys.stderr):
            raw_scores = reranker.predict(
                pairs,
                batch_size=_env_int(
                    "JOB_RAG_RERANK_BATCH_SIZE",
                    4,
                    minimum=1,
                    maximum=32,
                ),
                show_progress_bar=False,
            )
        if hasattr(raw_scores, "reshape"):
            raw_scores = raw_scores.reshape(-1).tolist()
        else:
            raw_scores = list(raw_scores)
        if len(raw_scores) != len(rerank_ids):
            raise RuntimeError("重排模型返回的分数数量与候选岗位不一致")

        raw_by_id = {
            job_id: float(score)
            for job_id, score in zip(rerank_ids, raw_scores)
        }
        raw_min = min(raw_by_id.values())
        raw_max = max(raw_by_id.values())
        raw_span = raw_max - raw_min
        normalized_scores = {
            job_id: (
                (score - raw_min) / raw_span
                if raw_span > 1e-9
                else 1.0
            )
            for job_id, score in raw_by_id.items()
        }
        rerank_sorted = sorted(
            rerank_ids,
            key=lambda job_id: raw_by_id[job_id],
            reverse=True,
        )
        rerank_ranks = {
            job_id: rank
            for rank, job_id in enumerate(rerank_sorted, start=1)
        }
        hybrid_ranks = {
            job_id: rank
            for rank, job_id in enumerate(rerank_ids, start=1)
        }
        rerank_fusion_scores = {
            job_id: (
                0.35 / (RRF_K + hybrid_ranks[job_id])
                + 0.65 / (RRF_K + rerank_ranks[job_id])
            )
            for job_id in rerank_ids
        }
        reranked_head = sorted(
            rerank_ids,
            key=lambda job_id: rerank_fusion_scores[job_id],
            reverse=True,
        )
        diagnostics.update(
            {
                "rerankerApplied": True,
                "rerankCandidates": rerank_count,
                "rerankElapsedMs": round(
                    (time.perf_counter() - started_at) * 1000,
                    2,
                ),
            }
        )
        return (
            reranked_head + ranked_ids[rerank_count:],
            normalized_scores,
            rerank_ranks,
            rerank_fusion_scores,
            diagnostics,
        )

    def _active_paths(self):
        pointer_path = _index_root() / "active-index.json"
        if not pointer_path.exists():
            raise FileNotFoundError(
                "岗位索引尚未构建，请先在项目目录运行 npm run build:job-index"
            )
        pointer = _read_json(pointer_path)
        version_dir = Path(pointer["version_dir"])
        if not version_dir.exists():
            version_dir = _index_root() / "versions" / pointer["version_id"]
        return {
            "pointer": pointer,
            "version_dir": version_dir,
            "manifest": version_dir / "manifest.json",
            "catalog": version_dir / "catalog.json",
            "lexical": version_dir / "lexical-index.json",
            "legacy_storage": version_dir / "llamaindex",
        }

    def status(self):
        try:
            paths = self._active_paths()
            manifest = _read_json(paths["manifest"])
            data_path = Path(
                os.environ.get("JOB_RAG_DATA_PATH", manifest["dataset_path"])
            )
            current_hash = _sha256_file(data_path) if data_path.exists() else ""
            common_ready = all(
                paths[key].exists()
                for key in ("manifest", "catalog", "lexical")
            )
            if manifest.get("vector_backend") == VECTOR_BACKEND:
                database = _inspect_qdrant(
                    manifest,
                    client=self.qdrant_client,
                )
                vector_ready = database["ready"]
            else:
                database = {
                    "type": "LlamaIndex SimpleVectorStore",
                    "backend": "legacy-simple-vector-store",
                    "path": str(paths["legacy_storage"]),
                    "collection": None,
                    "ready": paths["legacy_storage"].exists(),
                    "pointsCount": manifest.get("record_count", 0),
                    "storesFullJobPayload": False,
                }
                vector_ready = database["ready"]
            return {
                "ready": common_ready and vector_ready,
                "loaded": self.index is not None,
                "stale": current_hash != manifest.get("dataset_sha256"),
                "manifest": manifest,
                "database": database,
                "loaded_at": self.loaded_at,
                "cache": self._cache_status(),
                "reranker": self._reranker_status(),
            }
        except Exception as error:
            return {
                "ready": False,
                "loaded": False,
                "stale": False,
                "database": {
                    "type": "Qdrant Local",
                    "backend": VECTOR_BACKEND,
                    "path": str(_qdrant_path()),
                    "ready": False,
                },
                "cache": self._cache_status(),
                "reranker": self._reranker_status(),
                "error": str(error),
            }

    def load(self):
        if self.index is not None:
            return
        paths = self._active_paths()
        self.manifest = _read_json(paths["manifest"])
        catalog_payload = _read_json(paths["catalog"])
        self.catalog = {job["id"]: job for job in catalog_payload["jobs"]}
        self.lexical_index = _read_json(paths["lexical"])
        if self.manifest.get("vector_backend") == VECTOR_BACKEND:
            try:
                from llama_index.core import VectorStoreIndex
                from llama_index.vector_stores.qdrant import QdrantVectorStore
                from qdrant_client import QdrantClient
            except ImportError as error:
                raise RuntimeError(
                    "缺少 Qdrant RAG 依赖，请先运行 npm run setup:rag"
                ) from error
            database = self.manifest["database"]
            database_path = _manifest_qdrant_path(database)
            self.qdrant_client = QdrantClient(path=str(database_path))
            vector_store = QdrantVectorStore(
                client=self.qdrant_client,
                collection_name=database["collection"],
                index_doc_id=False,
            )
            with contextlib.redirect_stdout(sys.stderr):
                embed_model = _make_embed_model()
                self.index = VectorStoreIndex.from_vector_store(
                    vector_store=vector_store,
                    embed_model=embed_model,
                )
        else:
            try:
                from llama_index.core import StorageContext, load_index_from_storage
            except ImportError as error:
                raise RuntimeError(
                    "缺少 RAG 依赖，请先在项目目录运行 npm run setup:rag"
                ) from error
            with contextlib.redirect_stdout(sys.stderr):
                embed_model = _make_embed_model()
                storage_context = StorageContext.from_defaults(
                    persist_dir=str(paths["legacy_storage"])
                )
                self.index = load_index_from_storage(
                    storage_context,
                    embed_model=embed_model,
                )
        self.loaded_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    def close(self):
        self.index = None
        self.reranker = None
        self.reranker_loaded_source = None
        self.search_cache.clear()
        if self.qdrant_client is not None:
            self.qdrant_client.close()
            self.qdrant_client = None

    def warmup(self):
        self.load()
        if _reranker_enabled():
            self._load_reranker()
        return self.status()

    def search(self, body):
        query, queries = _normalize_search_queries(body)
        try:
            top_k = int(body.get("topK", 10))
        except (TypeError, ValueError):
            top_k = 10
        top_k = max(1, min(30, top_k))
        filters = _normalize_filters(body.get("filters"))

        self.load()
        started_at = time.perf_counter()
        rerank_enabled = (
            _reranker_enabled()
            and body.get("rerank") is not False
        )
        cache_bypassed = body.get("bypassCache") is True
        cache_key = self._search_cache_key(
            queries,
            top_k,
            filters,
            rerank_enabled,
        )
        if not cache_bypassed:
            cached_response, cache_age_ms = self._cache_get(cache_key)
            if cached_response is not None:
                cached_response["elapsedMs"] = round(
                    (time.perf_counter() - started_at) * 1000,
                    2,
                )
                cached_response["retrievalDiagnostics"].update(
                    {
                        "cacheHit": True,
                        "cacheAgeMs": cache_age_ms,
                        "cacheEntries": len(self.search_cache),
                        "cacheMaxEntries": self.cache_max_entries,
                        "cacheTtlSeconds": self.cache_ttl_seconds,
                        "cacheBypassed": False,
                    }
                )
                return cached_response
        cache_diagnostics = {
            "cacheHit": False,
            "cacheAgeMs": 0,
            "cacheEntries": len(self.search_cache),
            "cacheMaxEntries": self.cache_max_entries,
            "cacheTtlSeconds": self.cache_ttl_seconds,
            "cacheBypassed": cache_bypassed,
        }
        candidate_ids = [
            job_id
            for job_id, job in self.catalog.items()
            if _matches_filters(job, filters)
        ]
        nodes_per_record = max(
            1,
            int(self.manifest.get("nodes_per_record") or 1),
        )
        candidate_node_count = len(candidate_ids) * nodes_per_record
        dense_limit = min(
            candidate_node_count,
            max(60, top_k * nodes_per_record * 2),
        )
        filter_pushdown = (
            self.manifest.get("vector_backend") == VECTOR_BACKEND
            and len(candidate_ids) < len(self.catalog)
        )
        if not candidate_ids:
            _, _, _, _, rerank_diagnostics = self._rerank_jobs(
                queries,
                [],
                top_k,
                rerank_enabled,
            )
            response = {
                "query": query,
                "queries": queries,
                "queryCount": len(queries),
                "topK": top_k,
                "filters": filters,
                "totalCandidates": 0,
                "elapsedMs": round((time.perf_counter() - started_at) * 1000, 2),
                "indexVersion": self.manifest["version_id"],
                "retrievalDiagnostics": {
                    "queryCount": len(queries),
                    "denseLimitPerQuery": 0,
                    "denseNodesRetrieved": 0,
                    "denseCandidatesRetrieved": 0,
                    "nodesPerRecord": nodes_per_record,
                    "filterPushdown": False,
                    **rerank_diagnostics,
                    **cache_diagnostics,
                },
                "results": [],
            }
            if not cache_bypassed:
                self._cache_put(cache_key, response)
                response["retrievalDiagnostics"]["cacheEntries"] = len(
                    self.search_cache
                )
            return response

        vector_store_kwargs = {}
        if filter_pushdown:
            from qdrant_client import models as qdrant_models

            if self.manifest.get("index_strategy") == INDEX_STRATEGY:
                candidate_node_ids = [
                    _job_node_id(job_id, section)
                    for job_id in candidate_ids
                    for section in NODE_SECTIONS
                ]
            else:
                candidate_node_ids = [
                    _job_node_id(job_id)
                    for job_id in candidate_ids
                ]
            vector_store_kwargs["qdrant_filters"] = qdrant_models.Filter(
                must=[
                    qdrant_models.HasIdCondition(
                        has_id=candidate_node_ids,
                    )
                ]
            )
        retriever = self.index.as_retriever(
            similarity_top_k=dense_limit,
            vector_store_kwargs=vector_store_kwargs,
        )
        dense_scores = {}
        dense_query_fusion = {}
        dense_node_ids = set()
        matched_sections_by_job = {}
        query_weights = [1.0, 0.86, 0.74]
        candidate_id_set = set(candidate_ids)
        for query_index, active_query in enumerate(queries):
            with contextlib.redirect_stdout(sys.stderr):
                dense_nodes = retriever.retrieve(active_query)
            dense_query_ids = []
            for node in dense_nodes:
                job_id = node.node.metadata.get("job_id") or node.node.node_id
                if job_id not in candidate_id_set:
                    continue
                score = float(node.score or 0)
                dense_scores[job_id] = max(dense_scores.get(job_id, score), score)
                dense_node_ids.add(node.node.node_id)
                section_type = node.node.metadata.get("section_type")
                if section_type:
                    matched_sections_by_job.setdefault(job_id, set()).add(
                        section_type
                    )
                if job_id not in dense_query_ids:
                    dense_query_ids.append(job_id)
            weight = query_weights[query_index]
            for rank, job_id in enumerate(dense_query_ids, start=1):
                dense_query_fusion[job_id] = (
                    dense_query_fusion.get(job_id, 0)
                    + weight / (RRF_K + rank)
                )
        dense_ranked = sorted(
            dense_query_fusion,
            key=lambda job_id: (
                dense_query_fusion[job_id],
                dense_scores.get(job_id, 0),
            ),
            reverse=True,
        )
        dense_ranks = {
            job_id: rank
            for rank, job_id in enumerate(dense_ranked, start=1)
        }

        query_tokens = []
        lexical_scores = {}
        lexical_query_fusion = {}
        for query_index, active_query in enumerate(queries):
            active_tokens = _tokenize(active_query)
            query_tokens.extend(active_tokens)
            active_scores = _bm25_scores(
                active_tokens,
                self.lexical_index,
                candidate_ids,
            )
            active_ranked = sorted(
                active_scores,
                key=lambda job_id: active_scores[job_id],
                reverse=True,
            )
            weight = query_weights[query_index]
            for rank, job_id in enumerate(active_ranked, start=1):
                lexical_query_fusion[job_id] = (
                    lexical_query_fusion.get(job_id, 0)
                    + weight / (RRF_K + rank)
                )
                lexical_scores[job_id] = max(
                    lexical_scores.get(job_id, active_scores[job_id]),
                    active_scores[job_id],
                )
        lexical_ranked = sorted(
            lexical_query_fusion,
            key=lambda job_id: (
                lexical_query_fusion[job_id],
                lexical_scores.get(job_id, 0),
            ),
            reverse=True,
        )
        lexical_ranks = {
            job_id: rank
            for rank, job_id in enumerate(lexical_ranked, start=1)
        }

        fused_scores = {}
        for job_id in candidate_ids:
            score = 0.0
            if job_id in dense_ranks:
                score += 0.65 / (RRF_K + dense_ranks[job_id])
            if job_id in lexical_ranks:
                score += 0.35 / (RRF_K + lexical_ranks[job_id])

            job = self.catalog[job_id]
            title = str(job.get("title", "")).lower()
            skills = {str(skill).lower() for skill in job.get("skills") or []}
            title_matches = sum(
                1 for token in set(query_tokens) if len(token) > 1 and token in title
            )
            skill_matches = sum(
                1 for token in set(query_tokens) if token.lower() in skills
            )
            score += min(title_matches, 4) * 0.0005
            score += min(skill_matches, 4) * 0.0007
            fused_scores[job_id] = score

        ranked_ids = sorted(
            candidate_ids,
            key=lambda job_id: (
                fused_scores.get(job_id, 0),
                dense_scores.get(job_id, 0),
                lexical_scores.get(job_id, 0),
            ),
            reverse=True,
        )
        try:
            (
                ranked_ids,
                rerank_scores,
                rerank_ranks,
                rerank_fusion_scores,
                rerank_diagnostics,
            ) = self._rerank_jobs(
                queries,
                ranked_ids,
                top_k,
                rerank_enabled,
            )
        except Exception as error:
            if _env_bool("JOB_RAG_RERANK_STRICT", False):
                raise
            self.reranker = None
            self.reranker_error = str(error)[:500]
            rerank_scores = {}
            rerank_ranks = {}
            rerank_fusion_scores = {}
            rerank_diagnostics = {
                "rerankerEnabled": rerank_enabled,
                "rerankerApplied": False,
                "rerankerModel": _reranker_model_name(),
                "rerankerSource": _reranker_source(),
                "rerankerMaxLength": _reranker_max_length(),
                "rerankCandidates": 0,
                "rerankElapsedMs": 0,
                "rerankerError": self.reranker_error,
            }
        ranking_scores = dict(fused_scores)
        ranking_scores.update(rerank_fusion_scores)
        max_ranking_score = max(
            (ranking_scores.get(job_id, 0) for job_id in ranked_ids[:top_k]),
            default=1,
        ) or 1
        results = []
        query_token_set = {
            token
            for token in query_tokens
            if len(token) > 1 or re.fullmatch(r"[a-z0-9+#.]+", token)
        }
        evidence_token_target = min(max(len(query_token_set), 1), 8)
        for job_id in ranked_ids[:top_k]:
            job = self.catalog[job_id]
            job_tokens = set(self.lexical_index["tokens_by_id"].get(job_id, []))
            matched_terms = [
                token
                for token in query_tokens
                if token in job_tokens and token not in STOP_WORDS
            ]
            unique_terms = list(dict.fromkeys(matched_terms))[:12]
            dense_score = dense_scores.get(job_id, 0)
            dense_confidence = max(
                0.0,
                min(1.0, (dense_score - 0.32) / 0.36),
            )
            lexical_confidence = min(
                1.0,
                len(unique_terms) / evidence_token_target,
            )
            evidence_confidence = (
                dense_confidence * 0.72
                + lexical_confidence * 0.28
            )
            result = _public_job(job)
            result["retrieval"] = {
                "score": round(
                    ranking_scores[job_id] / max_ranking_score,
                    6,
                ),
                "confidence": round(evidence_confidence, 6),
                "denseScore": round(dense_score, 6),
                "lexicalScore": round(lexical_scores.get(job_id, 0), 6),
                "denseRank": dense_ranks.get(job_id),
                "lexicalRank": lexical_ranks.get(job_id),
                "rerankScore": (
                    round(rerank_scores[job_id], 6)
                    if job_id in rerank_scores
                    else None
                ),
                "rerankRank": rerank_ranks.get(job_id),
                "matchedTerms": unique_terms,
                "matchedSections": sorted(
                    matched_sections_by_job.get(job_id, set())
                ),
            }
            results.append(result)

        response = {
            "query": query,
            "queries": queries,
            "queryCount": len(queries),
            "topK": top_k,
            "filters": filters,
            "totalCandidates": len(candidate_ids),
            "elapsedMs": round((time.perf_counter() - started_at) * 1000, 2),
            "indexVersion": self.manifest["version_id"],
            "retrievalDiagnostics": {
                "queryCount": len(queries),
                "denseLimitPerQuery": dense_limit,
                "denseNodesRetrieved": len(dense_node_ids),
                "denseCandidatesRetrieved": len(dense_scores),
                "nodesPerRecord": nodes_per_record,
                "filterPushdown": filter_pushdown,
                **rerank_diagnostics,
                **cache_diagnostics,
            },
            "results": results,
        }
        if not cache_bypassed:
            self._cache_put(cache_key, response)
            response["retrievalDiagnostics"]["cacheEntries"] = len(
                self.search_cache
            )
        return response


def _respond(payload):
    sys.stdout.write(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    sys.stdout.flush()


def serve():
    knowledge_base = JobKnowledgeBase()
    try:
        for raw_line in sys.stdin:
            request_id = None
            try:
                request = json.loads(raw_line)
                request_id = request.get("id")
                action = request.get("action", "search")
                if action == "status":
                    result = knowledge_base.status()
                elif action == "warmup":
                    result = knowledge_base.warmup()
                elif action == "search":
                    result = knowledge_base.search(request.get("body") or {})
                else:
                    raise ValueError(f"不支持的岗位知识库操作：{action}")
                _respond({"id": request_id, "ok": True, "result": result})
            except Exception as error:
                traceback.print_exc(file=sys.stderr)
                _respond(
                    {
                        "id": request_id,
                        "ok": False,
                        "error": str(error)[:800],
                    }
                )
    finally:
        knowledge_base.close()


def main():
    parser = argparse.ArgumentParser(description="孔明职配岗位 RAG 本地工作进程")
    parser.add_argument("--build", action="store_true", help="构建并持久化岗位索引")
    parser.add_argument("--force", action="store_true", help="强制重建当前版本")
    parser.add_argument("--search", type=str, help="执行一次命令行检索")
    parser.add_argument("--top-k", type=int, default=10, help="命令行检索返回数量")
    parser.add_argument("--serve", action="store_true", help="启动 JSON Lines 工作进程")
    arguments = parser.parse_args()

    if arguments.build:
        result = build_index(force=arguments.force)
        _respond({"ok": True, "result": result})
        return
    if arguments.search:
        knowledge_base = JobKnowledgeBase()
        try:
            result = knowledge_base.search(
                {"query": arguments.search, "topK": arguments.top_k}
            )
            _respond({"ok": True, "result": result})
        finally:
            knowledge_base.close()
        return
    if arguments.serve:
        serve()
        return
    parser.print_help()


if __name__ == "__main__":
    main()
