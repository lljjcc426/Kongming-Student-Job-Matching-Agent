import argparse
import json
import os
import sys
import time
from pathlib import Path


DEFAULT_MODEL = "BAAI/bge-reranker-v2-m3"
DEFAULT_TARGET = Path(
    r"D:\ai_models\kongming-rerankers\bge-reranker-v2-m3"
)
DEFAULT_REPORT = Path(
    r"D:\Kongming-RAG\jobs-v1\index\reranker-cache-verification.json"
)
REQUIRED_FILES = (
    "config.json",
    "model.safetensors",
    "tokenizer_config.json",
)


def _write_report(report_path, payload):
    report_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = report_path.with_suffix(report_path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary_path, report_path)


def _directory_size(directory):
    return sum(
        file_path.stat().st_size
        for file_path in directory.rglob("*")
        if file_path.is_file()
    )


def _validate_snapshot(target_path):
    missing = [
        file_name
        for file_name in REQUIRED_FILES
        if not (target_path / file_name).is_file()
    ]
    tokenizer_available = any(
        (target_path / file_name).is_file()
        for file_name in ("tokenizer.json", "sentencepiece.bpe.model")
    )
    if not tokenizer_available:
        missing.append("tokenizer.json 或 sentencepiece.bpe.model")
    if missing:
        raise FileNotFoundError(
            "重排模型快照不完整，缺少：" + "、".join(missing)
        )


def _cleanup_stale_downloads(target_path):
    download_cache = target_path / ".cache" / "huggingface" / "download"
    removed_bytes = 0
    removed_files = 0
    if not download_cache.is_dir():
        return {"files": removed_files, "bytes": removed_bytes}
    for file_path in download_cache.glob("*.incomplete"):
        removed_bytes += file_path.stat().st_size
        file_path.unlink()
        removed_files += 1
    return {"files": removed_files, "bytes": removed_bytes}


def _smoke_test(target_path, device):
    from sentence_transformers import CrossEncoder

    model = CrossEncoder(
        str(target_path),
        device=device,
        local_files_only=True,
        max_length=384,
    )
    query = "北京大模型算法实习生，熟悉 Python、RAG 和模型评测"
    relevant = (
        "职位：大模型算法实习生；地点：北京；"
        "要求：熟悉 Python、检索增强生成、模型训练与评测。"
    )
    unrelated = (
        "职位：视觉设计实习生；地点：上海；"
        "要求：熟悉品牌视觉、海报设计与动效制作。"
    )
    scores = model.predict(
        [[query, relevant], [query, unrelated]],
        batch_size=2,
        show_progress_bar=False,
    )
    scores = [float(score) for score in scores.reshape(-1).tolist()]
    if len(scores) != 2 or scores[0] <= scores[1]:
        raise RuntimeError(
            "重排模型冒烟测试未能将相关岗位排在无关岗位之前"
        )
    return {
        "relevantScore": round(scores[0], 6),
        "unrelatedScore": round(scores[1], 6),
        "orderingValid": True,
    }


def main():
    parser = argparse.ArgumentParser(
        description="下载并离线验证孔明职配岗位重排模型"
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("JOB_RAG_RERANK_MODEL", DEFAULT_MODEL),
    )
    parser.add_argument(
        "--target",
        type=Path,
        default=Path(
            os.environ.get("JOB_RAG_RERANK_MODEL_PATH", DEFAULT_TARGET)
        ),
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path(
            os.environ.get(
                "JOB_RAG_RERANK_CACHE_REPORT_PATH",
                DEFAULT_REPORT,
            )
        ),
    )
    parser.add_argument(
        "--revision",
        default=os.environ.get("JOB_RAG_RERANK_REVISION", "main"),
    )
    parser.add_argument(
        "--device",
        default=os.environ.get("JOB_RAG_RERANK_DEVICE", "cpu"),
    )
    arguments = parser.parse_args()

    hugging_face_home = Path(
        os.environ.get("HF_HOME", r"D:\ai_models\huggingface")
    )
    hub_cache = Path(
        os.environ.get("HF_HUB_CACHE", hugging_face_home / "hub")
    )
    os.environ.setdefault("HF_HOME", str(hugging_face_home))
    os.environ.setdefault("HF_HUB_CACHE", str(hub_cache))
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

    started_at = time.perf_counter()
    report = {
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "passed": False,
        "model": arguments.model,
        "revision": arguments.revision,
        "model_path": str(arguments.target),
        "hub_cache": str(hub_cache),
        "device": arguments.device,
    }
    try:
        from huggingface_hub import snapshot_download

        arguments.target.parent.mkdir(parents=True, exist_ok=True)
        hub_cache.mkdir(parents=True, exist_ok=True)
        downloaded_path = snapshot_download(
            repo_id=arguments.model,
            revision=arguments.revision,
            local_dir=str(arguments.target),
            cache_dir=str(hub_cache),
        )
        target_path = Path(downloaded_path).resolve()
        _validate_snapshot(target_path)
        cleanup = _cleanup_stale_downloads(target_path)
        smoke_test = _smoke_test(
            target_path,
            arguments.device,
        )
        report.update(
            {
                "passed": True,
                "model_path": str(target_path),
                "size_bytes": _directory_size(target_path),
                "stale_downloads_removed": cleanup,
                "smoke_test": smoke_test,
            }
        )
    except Exception as error:
        report["error"] = str(error)[:1000]
        raise
    finally:
        report["elapsed_ms"] = round(
            (time.perf_counter() - started_at) * 1000,
            2,
        )
        _write_report(arguments.report, report)
        print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"[重排模型] 缓存或验证失败：{error}", file=sys.stderr)
        raise SystemExit(1)
