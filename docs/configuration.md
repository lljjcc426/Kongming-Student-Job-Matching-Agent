# 配置与部署

## 配置原则

服务端变量由运行进程或部署平台注入。本地使用 `.env.example` 创建 `.env`，然后运行 `node --env-file=.env --run dev`。修改服务端配置后需要重启。

API 凭据不使用 `VITE_` 前缀；带该前缀的变量可被 Vite 编译进浏览器代码。根目录 `.gitignore` 已排除 `.env` 和本地环境文件。

## 模型服务

| 变量 | 用途 / 默认值 |
| --- | --- |
| `ARK_API_KEY` | 火山方舟 API Key，模型调用必需。 |
| `ARK_BASE_URL` | 默认 `https://ark.cn-beijing.volces.com/api/v3`。 |
| `ARK_TEXT_MODEL` | 文本任务使用的模型 ID；未设置时依次使用 `ARK_MODEL`、代码默认模型。 |
| `ARK_VISION_MODEL` | 视觉任务模型；未设置时依次使用 `ARK_MODEL`、`ARK_TEXT_MODEL`、代码默认模型。 |
| `ARK_REQUEST_TIMEOUT_MS` | 请求超时，默认 `65000` 毫秒。 |

模型应按账号实际权限配置；代码默认 ID 不保证对每个账号可用。模型任务包括简历结构化、视觉识别、JD 分析、岗位方向建议、匹配解释、面试反馈与求职对话。

## OCR

| 变量 | 用途 |
| --- | --- |
| `OCR_PROVIDER` | `local`（默认）或 `volcengine`。 |
| `OCR_PYTHON_PATH` | 本地 OCR 的 Python 可执行文件。 |
| `OCR_MODEL_CACHE` | 本地 OCR 模型缓存路径。 |
| `VOLC_OCR_ACCESS_KEY` / `VOLC_OCR_SECRET_KEY` | 火山 OCR 服务端凭据。 |
| `VOLC_OCR_SESSION_TOKEN` | 使用临时凭据时的可选令牌。 |

详见 [OCR 接入](12-ocr-integration.md)。

## 本地岗位知识库

| 变量 | 用途 |
| --- | --- |
| `JOB_RAG_PYTHON_PATH` | 检索工作进程的 Python 可执行文件。 |
| `JOB_RAG_DATA_PATH` | 岗位 JSONL 文件路径。 |
| `JOB_RAG_INDEX_ROOT` | 检索索引与清单目录。 |
| `JOB_RAG_QDRANT_PATH` | Qdrant 本地持久化目录。 |
| `HF_HOME` | 嵌入模型缓存目录。 |
| `JOB_RAG_SKIP_WARMUP` | `true` 跳过开发启动时的预热，适用于仅查看界面。 |
| `JOB_RAG_RERANK_ENABLED` | 可选 CrossEncoder 重排，默认关闭。 |

路径使用绝对路径。Windows 原有脚本默认使用 D 盘；在其他系统上需显式配置数据、索引与模型缓存。缓存、过滤与重排的详细参数见[岗位知识库](14-job-rag-knowledge-base.md)。

## 开发与部署方式

| 方式 | 可用范围 |
| --- | --- |
| `npm run dev` / `node --env-file=.env --run dev` | Vite 前端 + `/api/ark`、`/api/ocr`、`/api/jobs/search` 开发代理，可启动本地 Python 工作进程。 |
| `npm run build` + `npm run preview` | TypeScript 检查、静态打包与静态预览，不包含开发 API 代理。 |
| Vercel | Vite 静态产物 + `api/ark.js` 与 `api/ocr.js` 函数；OCR 需配置云端提供方。 |

### Vercel

1. 导入当前仓库，选择 Node.js 24.x 与 Vite。
2. 使用 `npm ci` 安装、`npm run build` 构建，输出目录为 `dist`。
3. 在平台环境变量中配置 `ARK_API_KEY` 与可用模型 ID。
4. 若启用 OCR，配置 `OCR_PROVIDER=volcengine` 与对应服务端凭据。

仓库中的 `vercel.json` 已定义 API 缓存、浏览器权限与响应头。当前未提供 Vercel 岗位检索函数；本地 Qdrant 和常驻 Python 工作进程不能直接部署到 Serverless。完整知识库部署需要独立的检索服务及持久化存储，并适配应用接口。

## 数据流与当前范围

解析与分析时，简历文本或页面图片会按所选流程发送到配置的模型 / OCR 服务。摄像头预览由浏览器控制；语音识别取决于浏览器实现。使用者应先了解所配置提供方的数据处理方式。

项目当前没有用户账号、跨会话持久化存储或自动投递功能；LiveTalking 适配器保留扩展入口，默认面试界面使用本地数字人预览。设计资料中的远期方案以已实现代码为准。

[安装与运行](getting-started.md) · [文档中心](README.md)
