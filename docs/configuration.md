# 配置与部署

## 创建配置文件

在项目根目录将 `.env.example` 复制为 `.env`，选择下列一种模型配置，然后启动应用：

```bash
node --env-file=.env --run dev
```

修改配置后重启进程。服务端从 `process.env` 读取变量；正式运行时也可由运行环境注入同名变量。

API Key 仅在服务端使用，不加 `VITE_` 前缀，不填入前端代码。`.env` 已被 Git 忽略。自行部署使用自己的 API Key 或本地模型服务，仓库不附带可供共享的凭据。

## 模型接入

### OpenAI

1. 登录 [OpenAI API 平台](https://platform.openai.com/)，创建自己的 API Key，并确认账号具备可用额度和模型权限。
2. 在 `.env` 中填入以下配置，将 `your_openai_api_key` 替换为自己的密钥。
3. 启动应用，在 AI 助手中发送一条文字消息，再上传简历检查结构化结果。

```dotenv
MODEL_PROVIDER=openai
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=your_openai_api_key
MODEL_TEXT_MODEL=gpt-4.1-mini
MODEL_VISION_MODEL=gpt-4.1-mini
```

该示例使用支持文字与图片输入的 `gpt-4.1-mini`。后端调用 Chat Completions，使用 `max_completion_tokens` 控制输出上限。可将模型 ID 替换为账号可用、支持该接口的其他模型。

官方参考：[API Key 与认证](https://developers.openai.com/api/reference/overview) · [Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create) · [模型能力](https://developers.openai.com/api/docs/models/gpt-4.1-mini)。

### Claude

1. 登录 [Claude Console](https://platform.claude.com/)，为当前工作区创建 API Key，并确认可用额度和模型权限。
2. 将 `.env` 中的模型配置替换为下列内容。
3. 重启应用，先测试文字对话，再测试图片简历。

```dotenv
MODEL_PROVIDER=anthropic
MODEL_BASE_URL=https://api.anthropic.com/v1
MODEL_API_KEY=your_claude_api_key
MODEL_TEXT_MODEL=claude-sonnet-4-6
MODEL_VISION_MODEL=claude-sonnet-4-6
```

后端直接调用 Anthropic Messages API，将系统提示词和图片转换为原生格式，并提取返回的文本内容。当前使用 `anthropic-version: 2026-10-21`，不需要额外搭建协议转换服务。示例模型 ID 可替换为账号可用的 Claude 模型；API Key 应绑定到具体工作区。

官方参考：[认证与 API 概览](https://platform.claude.com/docs/en/api/overview) · [Messages](https://platform.claude.com/docs/en/api/messages/create) · [模型列表](https://platform.claude.com/docs/en/models/overview)。

### 本地模型：Ollama

1. 安装并启动 [Ollama](https://ollama.com/)。桌面应用已运行时，通常无需再启动一份服务；纯命令行环境可通过 `ollama serve` 启动。
2. 下载适合本机资源的模型。以下使用支持图片输入的 Qwen3-VL 8B：

```bash
ollama pull qwen3-vl:8b
```

3. 修改 `.env`，然后启动或重启孔明职配：

```dotenv
MODEL_PROVIDER=ollama
MODEL_BASE_URL=http://127.0.0.1:11434/v1
MODEL_API_KEY=
MODEL_TEXT_MODEL=qwen3-vl:8b
MODEL_VISION_MODEL=qwen3-vl:8b
MODEL_REQUEST_TIMEOUT_MS=180000
```

本地 Ollama 默认无需 API Key。模型首次加载和推理时间取决于内存、显存与模型规模，可按实际情况调整超时；该示例不要求下载云端模型 SDK。

`127.0.0.1` 指运行应用后端的机器。模型服务位于另一台机器时，将地址替换为后端可访问的模型服务地址。只运行文本模型时，填写对应的 `MODEL_TEXT_MODEL` 并留空 `MODEL_VISION_MODEL`，图片与扫描件可通过 OCR 处理。

官方参考：[Ollama OpenAI 兼容接口](https://docs.ollama.com/api/openai-compatibility) · [Qwen3-VL 模型](https://ollama.com/library/qwen3-vl:8b)。

### 自定义 OpenAI 兼容接口

DeepSeek、通义千问等云端服务的 OpenAI 兼容端点，以及 vLLM、LM Studio 等本地服务，可使用统一配置。接口须支持 `POST /chat/completions` 和 `messages` 请求格式。

```dotenv
MODEL_PROVIDER=openai-compatible
MODEL_BASE_URL=https://your-model-service.example/v1
MODEL_API_KEY=your_own_api_key
MODEL_TEXT_MODEL=your_text_model_id
MODEL_VISION_MODEL=your_vision_model_id
```

- `MODEL_BASE_URL` 填提供方给出的 API 根地址，保留其要求的 `/v1` 等路径；不附加 `/chat/completions`，程序会补上。
- 认证使用 `Authorization: Bearer ...`。本地服务未启用认证时，将 `MODEL_API_KEY` 留空；启用认证时填写自己的密钥。
- 文本任务读取 `MODEL_TEXT_MODEL`，图片识别读取 `MODEL_VISION_MODEL`。图片输入采用 `image_url` + Base64 Data URL，服务与模型均需支持该格式。
- 兼容接口使用 `max_tokens`；不同提供方支持的模型能力与参数范围，以其官方文档为准。仅兼容 Responses API 或需要云厂商专用签名的接口需要另行适配。

### 配置项

| 变量 | 说明 |
| --- | --- |
| `MODEL_PROVIDER` | `openai`、`anthropic`、`openai-compatible`、`ollama`；使用新配置时默认 `openai`。 |
| `MODEL_BASE_URL` | API 根地址。OpenAI、Claude 和 Ollama 有上述默认值；自定义兼容接口必须填写。 |
| `MODEL_API_KEY` | 自己的服务端密钥。OpenAI / Claude 必需；本地免认证服务可留空。 |
| `MODEL_TEXT_MODEL` | 文本任务模型 ID，必填；用于结构化、JD 分析、匹配说明、面试反馈和对话。 |
| `MODEL_VISION_MODEL` | 支持图片输入的模型 ID；使用模型识别图片时必填，可与文本模型相同。 |
| `MODEL_REQUEST_TIMEOUT_MS` | 单次请求超时，默认 `65000` 毫秒；正整数。 |
| `MODEL_MAX_OUTPUT_TOKENS` | 可选，统一覆盖各任务的输出 token 上限；正整数。未填写时按任务分配约 1200–2520 tokens。 |

推理模型可能将输出额度用于内部思考。若返回文本为空或结构化 JSON 被截断，可提高 `MODEL_MAX_OUTPUT_TOKENS`，并结合实际延迟调整超时。当前模型路由使用同一提供方和 API 地址，支持在该服务内分别选择文本、视觉模型。

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

路径使用绝对路径。Windows 原有脚本默认使用 D 盘；其他系统需显式配置数据、索引与模型缓存。缓存、过滤与重排参数见[岗位知识库](14-job-rag-knowledge-base.md)。

## 构建与服务运行

| 命令 | 可用范围 |
| --- | --- |
| `node --env-file=.env --run dev` | Vite 界面与同源模型、OCR、岗位检索 API，可启动本地 Python 工作进程。 |
| `npm run build` | TypeScript 检查并生成 `dist` 静态产物。 |
| `node --env-file=.env --run start` | 生产 Node.js 服务，同时提供 `dist` 与同源 API，默认监听 `127.0.0.1:3000`。 |
| `npm run preview` | 预览静态产物，不包含开发 API。 |

生产入口为 `server/index.js`，复用 `server/arkCore.js`、`server/modelProvider.js` 等业务逻辑。通过 `HOST` 和 `PORT` 修改监听地址；使用进程管理器注入环境变量时可直接执行 `npm start`。服务器部署、HTTPS、更新与回滚见[服务器部署](deployment.md)。

生产服务仅在配置 `JOB_RAG_DATA_PATH` 后启用本地岗位知识库；还需准备 Python 环境、数据和持久化索引。未配置时，检索接口返回未就绪状态，界面保留模型方向建议。

## 常见问题

| 现象 | 检查方式 |
| --- | --- |
| 提示模型未配置 | 确认 `.env` 已加载，提供方、模型 ID 和必要密钥已填写；修改后重启。 |
| 上游返回 401 / 403 | 检查当前提供方的 API Key、账号权限和模型访问权限。 |
| 模型接口不可用 | 检查 API 地址、模型 ID、账号额度，以及应用后端到模型服务的网络连接。 |
| 图片任务失败 | 确认视觉模型已配置且支持图片；文本模型无需具备视觉能力。 |
| 响应超时 | 检查服务状态与本机模型加载情况，必要时调整 `MODEL_REQUEST_TIMEOUT_MS`。 |
| 返回文本为空 / JSON 不完整 | 确认模型支持对应接口，并提高 `MODEL_MAX_OUTPUT_TOKENS` 后重试。 |

## 账号与数据库

首次启动会自动创建 SQLite 表。开发环境默认保存在 `data/agent-memory/`；生产环境应显式指定发布目录之外的路径。

| 变量 | 用途 |
| --- | --- |
| `AGENT_MEMORY_DB_PATH` | SQLite 文件的绝对路径。 |
| `AGENT_MEMORY_BACKUP_DIR` | 在线备份目录；默认在数据库所在目录的 `backups/` 下。 |
| `AGENT_MEMORY_MAX_MESSAGES` | 每个账号最多保留的对话消息数，默认 120。 |
| `AGENT_MEMORY_RETENTION_DAYS` | 对话消息保存天数，默认 180；在后续写入时清理超期消息。 |

注册默认创建普通账号，管理员只通过服务器命令授权，具体命令与控制台指标口径见[管理员与服务控制台](deployment.md#管理员与服务控制台)。

注册后请保存恢复码；正式账号可通过昵称和密码跨设备登录。访客身份通过当前浏览器的会话 Cookie 恢复，有效期为 30 天；退出或清除 Cookie 后无法找回该访客身份。访客之间不共享记录。使用人数增加后，可迁移至独立数据库服务并增加账号用量控制。

## 数据流与当前范围

解析与分析时，简历文本或页面图片会按所选流程发送到配置的模型 / OCR 服务。摄像头预览由浏览器控制；语音识别取决于浏览器实现。

账号通过服务端会话识别，访客体验使用独立身份。对话、简历画像、目标岗位、面试记录与成长计划保存在服务端 SQLite 数据库，可在账号内清除；密码和恢复码仅保存加盐哈希。项目不提供自动投递功能；LiveTalking 适配器保留扩展入口，默认面试界面使用本地数字人预览。设计资料中的远期方案以已实现代码为准。

[安装与运行](getting-started.md) · [文档中心](README.md)
