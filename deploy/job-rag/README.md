# 岗位 RAG 独立服务

该容器把现有 LlamaIndex、Qdrant Local、BM25 和可选 CrossEncoder 重排链路
封装为私有 HTTP 服务。Vercel 仅作为轻量安全网关，不在函数内加载 Python、
2.3 GB 重排模型或 D 盘数据库。

## 数据目录

将本机 `D:\Kongming-RAG\jobs-v1` 同步到宿主持久磁盘的
`/data/jobs-v1`。容器会在活动索引指针仍包含 Windows 绝对路径时，自动按
`JOB_RAG_INDEX_ROOT/versions/<version_id>` 解析对应版本。

模型缓存应挂载到 `/models`。默认关闭远程服务中的重排器；如运行节点具备
足够内存或 GPU，可额外挂载重排模型并设置：

```text
JOB_RAG_RERANK_ENABLED=true
JOB_RAG_RERANK_MODEL_PATH=/models/kongming-rerankers/bge-reranker-v2-m3
```

## 构建与运行

从仓库根目录执行：

```powershell
docker build -f deploy/job-rag/Dockerfile -t kongming-job-rag .
docker run --rm -p 8080:8080 `
  -e JOB_RAG_SERVICE_TOKEN=<使用安全平台注入> `
  -v D:\Kongming-RAG:/data `
  -v D:\ai_models:/models `
  kongming-job-rag
```

镜像固定从 PyTorch 官方 CPU wheel 源安装 `torch==2.13.0+cpu`，避免默认 PyPI
解析出不需要的 CUDA 运行库。需要 GPU 推理时应单独维护 CUDA 基础镜像，不能
直接复用该 CPU 镜像。

不要把服务令牌写入命令历史、仓库或镜像。生产环境应通过部署平台的 Secret
功能注入，并使用 HTTPS。该 Qdrant Local 方案只运行一个服务副本；需要水平
扩展时再迁移到 Qdrant Cloud 或独立 Qdrant 集群。

## 接口

- `GET /health`：仅返回最小就绪状态，供容器健康检查使用；
- `GET /api/jobs/status`
- `POST /api/jobs/search`

岗位状态和检索接口要求
`Authorization: Bearer <JOB_RAG_SERVICE_TOKEN>`；健康检查不返回数据库、模型或
路径信息，因此不要求服务令牌。鉴权后的状态与检索响应同样采用字段白名单，
不会返回宿主路径、索引存储路径、模型路径或底层异常详情。
