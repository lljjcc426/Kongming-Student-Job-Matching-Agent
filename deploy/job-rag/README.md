# 岗位 RAG 独立服务

该容器把现有 LlamaIndex、Qdrant Local、BM25 和可选 CrossEncoder 重排链路
封装为私有 HTTP 服务。Vercel 仅作为轻量安全网关，不在函数内加载 Python、
重排模型或 D 盘数据库。

## 生产结构

```text
浏览器 -> Vercel /api/jobs/search -> HTTPS + Bearer Token -> 岗位 RAG 容器
```

RAG 容器只运行一个实例，使用挂载到 `/var/data` 的持久化磁盘保存岗位 JSONL、
活动索引和 Qdrant Local 数据。根目录的 `render.yaml` 已声明新加坡区、Standard
2 GB 实例、1 GB 持久化磁盘和 `/health` 健康检查。

生产镜像在构建时固定下载
`BAAI/bge-small-zh-v1.5@7999e1d3359715c523056ef9478215996d62a620`，无需上传
本机完整 Hugging Face 缓存。默认关闭线上重排器；如运行节点具备足够内存或
GPU，可额外挂载重排模型并设置：

```text
JOB_RAG_RERANK_ENABLED=true
JOB_RAG_RERANK_MODEL_PATH=/models/kongming-rerankers/bge-reranker-v2-m3
```

## 生成生产数据包

从仓库根目录执行：

```powershell
npm run package:job-rag-data
```

默认从 `D:\Kongming-RAG\jobs-v1` 读取数据，输出到
`D:\Kongming-RAG\releases`。输出包含 ZIP、`.sha256` 和非敏感元数据 JSON。
数据包只保留当前活动索引和对应 Qdrant collection，不包含测试日志、旧索引、
无关模型或 `.lock` 文件。打包前需要停止占用 Qdrant Local 的本地检索进程。

当前部署版本使用项目 GitHub Release 中的公开只读数据包，URL 与 SHA-256 已写入
`render.yaml`。如岗位库更新，应发布新的版本化 Release，并同时更新：

```text
JOB_RAG_DATA_ARCHIVE_URL=https://<新的只读下载地址>
JOB_RAG_DATA_ARCHIVE_SHA256=<新数据包的 64 位 SHA-256>
```

启动脚本会限制下载与解压体积、校验 SHA-256、防止 ZIP 路径穿越，并验证岗位
数量、索引版本、JSONL 哈希和 Qdrant collection。持久化目录已存在但不完整时
不会自动覆盖，避免损坏已有数据。

## 本地构建与运行

```powershell
docker build -f deploy/job-rag/Dockerfile -t kongming-job-rag .
$env:JOB_RAG_SERVICE_TOKEN=<仅在当前终端安全注入>
docker run --rm -p 8080:8080 `
  -e JOB_RAG_SERVICE_TOKEN `
  -v D:\Kongming-RAG:/data `
  kongming-job-rag
```

镜像固定从 PyTorch 官方 CPU wheel 源安装 `torch==2.13.0+cpu`，避免默认 PyPI
解析出不需要的 CUDA 运行库。需要 GPU 推理时应单独维护 CUDA 基础镜像，不能
直接复用该 CPU 镜像。

不要把服务令牌写入命令历史、仓库或镜像。生产环境应通过部署平台的 Secret
功能注入，并使用 HTTPS。Qdrant Local 只运行一个服务副本；需要水平扩展时再
迁移到 Qdrant Cloud 或独立 Qdrant 集群。

## Render 与 Vercel

1. 使用本项目 GitHub 仓库中的 `deploy/online-rag` 分支创建 Render Blueprint。
2. Render 按 `render.yaml` 自动创建单实例服务和持久化磁盘。
3. Render 自动生成 `JOB_RAG_SERVICE_TOKEN`；在控制台安全复制该值。
4. 在 Vercel Production Secret 中配置：

```text
JOB_RAG_BACKEND=remote
JOB_RAG_REMOTE_BASE_URL=https://<服务名>.onrender.com
JOB_RAG_REMOTE_TOKEN=<与 Render 的 JOB_RAG_SERVICE_TOKEN 相同>
JOB_RAG_REMOTE_TIMEOUT_MS=45000
```

5. 重新部署 Vercel。浏览器只访问同源 `/api/jobs/search`，不会接触 RAG 服务令牌。

## 接口

- `GET /health`：仅返回最小就绪状态，供容器健康检查使用；
- `GET /api/jobs/status`
- `POST /api/jobs/search`

岗位状态和检索接口要求
`Authorization: Bearer <JOB_RAG_SERVICE_TOKEN>`；健康检查不返回数据库、模型或
路径信息，因此不要求服务令牌。鉴权后的状态与检索响应采用字段白名单，不会
返回宿主路径、索引存储路径、模型路径或底层异常详情。
