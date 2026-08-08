import argparse
import hashlib
import hmac
import json
import os
import re
import shutil
import stat
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
from pathlib import Path


DEFAULT_MAX_ARCHIVE_BYTES = 512 * 1024 * 1024
MAX_ALLOWED_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024
VERSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{8,160}$")
SHA256_PATTERN = re.compile(r"^[a-fA-F0-9]{64}$")


class BootstrapError(RuntimeError):
    pass


def _read_positive_integer(name, default, maximum):
    raw_value = os.environ.get(name, "").strip()
    if not raw_value:
        return default
    try:
        value = int(raw_value)
    except ValueError as error:
        raise BootstrapError(f"{name} 必须是整数") from error
    if value <= 0 or value > maximum:
        raise BootstrapError(f"{name} 必须位于 1 到 {maximum} 之间")
    return value


def _sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _read_json(path):
    try:
        with path.open("r", encoding="utf-8-sig") as source:
            return json.load(source)
    except (OSError, json.JSONDecodeError) as error:
        raise BootstrapError(f"无法读取岗位知识库文件：{path.name}") from error


def _target_root():
    explicit_root = os.environ.get("JOB_RAG_DATA_ROOT", "").strip()
    data_path = Path(
        os.environ.get("JOB_RAG_DATA_PATH", "/data/jobs-v1/jobs-500.jsonl")
    )
    root = Path(explicit_root) if explicit_root else data_path.parent
    index_root = Path(
        os.environ.get("JOB_RAG_INDEX_ROOT", str(root / "index"))
    )
    qdrant_path = Path(
        os.environ.get(
            "JOB_RAG_QDRANT_PATH",
            str(root / "database" / "qdrant"),
        )
    )
    if data_path != root / "jobs-500.jsonl":
        raise BootstrapError(
            "线上数据包要求 JOB_RAG_DATA_PATH 指向数据根目录下的 jobs-500.jsonl"
        )
    if index_root != root / "index":
        raise BootstrapError(
            "线上数据包要求 JOB_RAG_INDEX_ROOT 指向数据根目录下的 index"
        )
    if qdrant_path != root / "database" / "qdrant":
        raise BootstrapError(
            "线上数据包要求 JOB_RAG_QDRANT_PATH 指向 data/database/qdrant"
        )
    return root


def _validate_dataset(root, normalize_pointer=False):
    dataset_path = root / "jobs-500.jsonl"
    pointer_path = root / "index" / "active-index.json"
    qdrant_root = root / "database" / "qdrant"
    for required_path in (dataset_path, pointer_path, qdrant_root / "meta.json"):
        if not required_path.exists():
            raise BootstrapError(f"岗位数据包缺少 {required_path.relative_to(root)}")

    pointer = _read_json(pointer_path)
    version_id = str(pointer.get("version_id") or "").strip()
    if not VERSION_ID_PATTERN.fullmatch(version_id):
        raise BootstrapError("岗位数据包中的 version_id 不合法")

    version_dir = root / "index" / "versions" / version_id
    manifest_path = version_dir / "manifest.json"
    catalog_path = version_dir / "catalog.json"
    lexical_path = version_dir / "lexical-index.json"
    for required_path in (manifest_path, catalog_path, lexical_path):
        if not required_path.is_file():
            raise BootstrapError(f"岗位数据包缺少 {required_path.relative_to(root)}")

    manifest = _read_json(manifest_path)
    if manifest.get("version_id") != version_id:
        raise BootstrapError("活动索引与 manifest 的 version_id 不一致")
    if manifest.get("vector_backend") != "qdrant-local":
        raise BootstrapError("线上数据包必须使用 qdrant-local 向量后端")

    database = manifest.get("database") or {}
    collection_name = str(database.get("collection") or "").strip()
    if not VERSION_ID_PATTERN.fullmatch(collection_name):
        raise BootstrapError("manifest 中的 Qdrant collection 不合法")
    collection_dir = qdrant_root / "collection" / collection_name
    if not collection_dir.is_dir() or not any(
        path.is_file() for path in collection_dir.rglob("*")
    ):
        raise BootstrapError("岗位数据包缺少活动 Qdrant collection")

    expected_dataset_hash = str(manifest.get("dataset_sha256") or "").lower()
    if not SHA256_PATTERN.fullmatch(expected_dataset_hash):
        raise BootstrapError("manifest 中的 dataset_sha256 不合法")
    actual_dataset_hash = _sha256_file(dataset_path)
    if actual_dataset_hash != expected_dataset_hash:
        raise BootstrapError("岗位 JSONL 的 SHA-256 与 manifest 不一致")

    with dataset_path.open("r", encoding="utf-8-sig") as dataset:
        record_count = sum(1 for line in dataset if line.strip())
    expected_record_count = int(manifest.get("record_count") or 0)
    if record_count <= 0 or record_count != expected_record_count:
        raise BootstrapError(
            f"岗位记录数量不完整：{record_count}/{expected_record_count}"
        )

    if normalize_pointer:
        pointer["version_dir"] = str(version_dir)
        temporary_pointer = pointer_path.with_name(
            f".{pointer_path.name}.{uuid.uuid4().hex}.tmp"
        )
        temporary_pointer.write_text(
            json.dumps(pointer, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(temporary_pointer, pointer_path)

    return {
        "version_id": version_id,
        "record_count": record_count,
        "node_count": int(manifest.get("node_count") or 0),
        "collection": collection_name,
        "dataset_sha256": actual_dataset_hash,
    }


class _HttpsOnlyRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        parsed_url = urllib.parse.urlsplit(new_url)
        if parsed_url.scheme != "https":
            raise BootstrapError("岗位数据包下载不允许降级到非 HTTPS 地址")
        return super().redirect_request(
            request,
            file_pointer,
            code,
            message,
            headers,
            new_url,
        )


def _copy_local_archive(source, destination, maximum_bytes):
    if not source.is_absolute() or not source.is_file():
        raise BootstrapError("JOB_RAG_DATA_ARCHIVE_PATH 必须是存在的绝对文件路径")
    if source.stat().st_size > maximum_bytes:
        raise BootstrapError("岗位数据包超过允许的最大体积")
    shutil.copyfile(source, destination)


def _download_archive(url, destination, maximum_bytes):
    parsed_url = urllib.parse.urlsplit(url)
    if parsed_url.scheme != "https" or not parsed_url.hostname:
        raise BootstrapError("JOB_RAG_DATA_ARCHIVE_URL 必须是有效的 HTTPS 地址")
    if parsed_url.username or parsed_url.password:
        raise BootstrapError("岗位数据包 URL 不能包含用户名或密码")

    headers = {"User-Agent": "KongmingJobRAGBootstrap/1.0"}
    archive_token = os.environ.get("JOB_RAG_DATA_ARCHIVE_TOKEN", "").strip()
    if archive_token:
        headers["Authorization"] = f"Bearer {archive_token}"
    request = urllib.request.Request(url, headers=headers, method="GET")
    timeout_seconds = _read_positive_integer(
        "JOB_RAG_DATA_DOWNLOAD_TIMEOUT_SECONDS",
        180,
        1800,
    )
    opener = urllib.request.build_opener(_HttpsOnlyRedirectHandler())
    try:
        with opener.open(request, timeout=timeout_seconds) as response:
            declared_length = response.headers.get("Content-Length")
            if declared_length:
                try:
                    if int(declared_length) > maximum_bytes:
                        raise BootstrapError("岗位数据包超过允许的最大体积")
                except ValueError:
                    pass
            downloaded_bytes = 0
            with destination.open("wb") as output:
                while True:
                    block = response.read(1024 * 1024)
                    if not block:
                        break
                    downloaded_bytes += len(block)
                    if downloaded_bytes > maximum_bytes:
                        raise BootstrapError("岗位数据包超过允许的最大体积")
                    output.write(block)
    except BootstrapError:
        raise
    except (OSError, urllib.error.URLError) as error:
        raise BootstrapError(
            f"无法从 {parsed_url.hostname} 下载岗位数据包"
        ) from error


def _safe_extract(archive_path, destination, maximum_bytes):
    extracted_bytes = 0
    normalized_names = set()
    try:
        with zipfile.ZipFile(archive_path) as archive:
            for item in archive.infolist():
                item_path = Path(item.filename.replace("\\", "/"))
                if (
                    item_path.is_absolute()
                    or ".." in item_path.parts
                    or (
                        item_path.parts
                        and re.fullmatch(r"[A-Za-z]:", item_path.parts[0])
                    )
                ):
                    raise BootstrapError("岗位数据包包含不安全路径")
                unix_mode = (item.external_attr >> 16) & 0o170000
                if unix_mode == stat.S_IFLNK:
                    raise BootstrapError("岗位数据包不能包含符号链接")
                extracted_bytes += item.file_size
                if extracted_bytes > maximum_bytes:
                    raise BootstrapError("岗位数据包解压后超过允许的最大体积")
                normalized_name = item_path.as_posix().rstrip("/")
                if not normalized_name:
                    continue
                if normalized_name in normalized_names:
                    raise BootstrapError("岗位数据包包含重复路径")
                normalized_names.add(normalized_name)

                target_path = destination.joinpath(*item_path.parts)
                try:
                    target_path.resolve().relative_to(destination.resolve())
                except ValueError as error:
                    raise BootstrapError("岗位数据包包含不安全路径") from error
                is_directory = (
                    item.is_dir()
                    or item.filename.endswith("/")
                    or item.filename.endswith("\\")
                )
                if is_directory:
                    target_path.mkdir(parents=True, exist_ok=True)
                    continue
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(item) as source, target_path.open("xb") as output:
                    shutil.copyfileobj(source, output, length=1024 * 1024)
    except BootstrapError:
        raise
    except (OSError, zipfile.BadZipFile) as error:
        raise BootstrapError("岗位数据包不是有效的 ZIP 文件") from error


def ensure_job_rag_data():
    root = _target_root()
    if root.exists():
        try:
            return _validate_dataset(root, normalize_pointer=True)
        except BootstrapError as error:
            raise BootstrapError(
                f"持久化目录已存在但不完整，为保护现有数据未自动覆盖：{error}"
            ) from error

    archive_path_value = os.environ.get("JOB_RAG_DATA_ARCHIVE_PATH", "").strip()
    archive_url = os.environ.get("JOB_RAG_DATA_ARCHIVE_URL", "").strip()
    if archive_path_value and archive_url:
        raise BootstrapError("岗位数据包本地路径和远程 URL 只能配置一个")
    if not archive_path_value and not archive_url:
        if os.environ.get("JOB_RAG_BOOTSTRAP_REQUIRED", "true").lower() == "true":
            raise BootstrapError(
                "岗位数据尚未初始化，请配置 JOB_RAG_DATA_ARCHIVE_URL 和 SHA-256"
            )
        return None

    expected_hash = os.environ.get("JOB_RAG_DATA_ARCHIVE_SHA256", "").strip().lower()
    if not SHA256_PATTERN.fullmatch(expected_hash):
        raise BootstrapError("必须配置 64 位 JOB_RAG_DATA_ARCHIVE_SHA256")

    maximum_bytes = _read_positive_integer(
        "JOB_RAG_DATA_ARCHIVE_MAX_BYTES",
        DEFAULT_MAX_ARCHIVE_BYTES,
        MAX_ALLOWED_ARCHIVE_BYTES,
    )
    root.parent.mkdir(parents=True, exist_ok=True)
    archive_descriptor, archive_name = tempfile.mkstemp(
        prefix=".job-rag-archive-",
        suffix=".zip",
        dir=root.parent,
    )
    os.close(archive_descriptor)
    archive_file = Path(archive_name)
    staging_root = root.parent / f".job-rag-stage-{uuid.uuid4().hex}"
    try:
        if archive_path_value:
            _copy_local_archive(Path(archive_path_value), archive_file, maximum_bytes)
        else:
            _download_archive(archive_url, archive_file, maximum_bytes)
        actual_hash = _sha256_file(archive_file)
        if not hmac.compare_digest(actual_hash, expected_hash):
            raise BootstrapError("岗位数据包 SHA-256 校验失败")

        staging_root.mkdir(parents=True, exist_ok=False)
        _safe_extract(archive_file, staging_root, maximum_bytes)
        staged_dataset = staging_root / "jobs-v1"
        _validate_dataset(staged_dataset, normalize_pointer=False)
        if root.exists():
            raise BootstrapError("初始化期间目标目录被其他进程创建，请稍后重试")
        os.replace(staged_dataset, root)
        return _validate_dataset(root, normalize_pointer=True)
    finally:
        archive_file.unlink(missing_ok=True)
        if staging_root.exists():
            shutil.rmtree(staging_root)


def main():
    parser = argparse.ArgumentParser(description="初始化线上岗位 RAG 数据")
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="只初始化并验证数据，不启动 HTTP 服务",
    )
    arguments = parser.parse_args()
    try:
        report = ensure_job_rag_data()
        if report:
            print(
                "[job-rag-bootstrap] "
                + json.dumps(
                    {
                        "ready": True,
                        "version_id": report["version_id"],
                        "record_count": report["record_count"],
                        "node_count": report["node_count"],
                    },
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
                file=sys.stderr,
            )
    except BootstrapError as error:
        print(f"[job-rag-bootstrap] {error}", file=sys.stderr)
        raise SystemExit(1) from error

    if arguments.prepare_only:
        return
    from job_rag_http_service import main as service_main

    service_main()


if __name__ == "__main__":
    main()
