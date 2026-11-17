# 安装与运行

## 基础环境

- Node.js **24.x** 与 npm，对应 `package.json` 的引擎要求。
- 自己的模型 API Key，或已启动的本地模型服务。
- OCR 与岗位知识库按需安装，无需为浏览界面提前下载全部 Python 依赖。

```bash
git clone https://github.com/lljjcc426/Kongming-Student-Job-Matching-Agent.git
cd Kongming-Student-Job-Matching-Agent
npm ci
```

## 模型配置与启动

复制根目录 `.env.example` 为 `.env`。macOS / Linux 可执行 `cp .env.example .env`，PowerShell 可执行 `Copy-Item .env.example .env`。

选择模型接入方式。以下以 OpenAI 为例，Claude、本地 Ollama 和自定义接口见[模型配置教程](configuration.md#模型接入)。编辑 `.env`：

```dotenv
MODEL_PROVIDER=openai
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_API_KEY=your_openai_api_key
MODEL_TEXT_MODEL=gpt-4.1-mini
MODEL_VISION_MODEL=gpt-4.1-mini
```

启动前端与同源 API：

```bash
node --env-file=.env --run dev
```

打开终端显示的地址，通常为 `http://localhost:5173`。服务端代码读取 `process.env`；上述 Node.js 命令负责加载 `.env`。如果已通过终端或部署平台注入变量，也可使用 `npm run dev`。

首次使用建议上传文本或带文字层的 PDF 简历，检查识别字段，再查看简历解析、岗位推荐和模拟面试。图片及扫描件需要 OCR，或可用的视觉模型。当前不直接读取 Word 文件，请先导出为 PDF / TXT，或复制正文到文本输入区。

未配置本地知识库时，可在 `.env` 中设置 `JOB_RAG_SKIP_WARMUP=true`，跳过开发服务启动时的知识库预热。该选项不提供岗位数据；推荐流程仍会尝试检索，并在不可用时提示模型方向建议。

## OCR

### Windows

安装 Conda 后运行：

```powershell
npm run setup:ocr
```

脚本默认创建 `D:\conda_envs\kongming-ocr`。可通过 `OCR_PYTHON_PATH` 指向已有环境；云端 OCR 配置见 [OCR 接入](12-ocr-integration.md)。

### macOS / Linux

使用 Python 3.11 创建独立环境并安装依赖：

```bash
python3.11 -m venv .venv-ocr
.venv-ocr/bin/python -m pip install -r scripts/ocr-requirements.txt
```

将 `.env` 的 `OCR_PYTHON_PATH` 设置为该环境 Python 的绝对路径，并设置 `OCR_PROVIDER=local`，然后重启开发服务。首次识别可能需要下载 OCR 模型。

## 本地岗位知识库

知识库依赖独立的岗位 JSONL、Python 环境与索引，仓库未附带原开发环境的 500 条岗位数据、索引或模型权重。

### Windows / PowerShell

```powershell
npm run setup:rag
npm run collect:jobs
npm run build:job-index
```

采集脚本当前要求输出目录位于 D 盘，默认写入 `D:\Kongming-RAG\jobs-v1`。采集企业官方招聘信息时，需遵守来源站点规则；岗位可用性会随时间变化。已有符合数据契约的 JSONL 时可跳过采集步骤。

### macOS / Linux

先准备符合[岗位知识库数据契约](14-job-rag-knowledge-base.md)的 JSONL，使用 Python 3.11 安装检索依赖：

```bash
python3.11 -m venv .venv-rag
.venv-rag/bin/python -m pip install -r scripts/rag-requirements.txt
```

在 `.env` 中配置绝对路径：

```dotenv
JOB_RAG_PYTHON_PATH=/absolute/path/to/.venv-rag/bin/python
JOB_RAG_DATA_PATH=/absolute/path/to/jobs-500.jsonl
JOB_RAG_INDEX_ROOT=/absolute/path/to/index
JOB_RAG_QDRANT_PATH=/absolute/path/to/database/qdrant
HF_HOME=/absolute/path/to/huggingface
```

在项目根目录将同一份 `.env` 加载到 Python 子进程，构建索引：

```bash
node --env-file=.env --input-type=module -e 'import { spawnSync } from "node:child_process"; const result = spawnSync(process.env.JOB_RAG_PYTHON_PATH, ["server/job_knowledge_worker.py", "--build"], { stdio: "inherit", env: process.env }); process.exit(result.status ?? 1);'
```

该命令面向 macOS / Linux shell。构建完成后移除 `JOB_RAG_SKIP_WARMUP=true`，重新启动开发服务。Qdrant 本地目录由一个工作进程持有；重建索引前先停止开发服务。

## 构建与预览

```bash
npm run build
npm run preview
```

`build` 执行 TypeScript 检查和 Vite 打包；`preview` 仅提供静态文件，不能替代包含 API 的开发或部署服务。

运行包含同源 API 的生产服务：

```bash
npm run build
node --env-file=.env --run start
```

默认访问 `http://127.0.0.1:3000`。公网部署使用反向代理与进程管理，详见[服务器部署](deployment.md)。

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| 提示模型服务尚未配置 | 检查 `MODEL_PROVIDER`、`MODEL_API_KEY` 和模型 ID，使用 `node --env-file=.env --run dev` 启动，或向进程注入变量后重启。 |
| 模型不可用 / 无权限 | 检查模型服务账号余额、API Key、接口地址和模型 ID；图片识别使用支持视觉输入的模型。 |
| 岗位知识库未连接 | 检查 JSONL、索引与 Python 路径；模型方向建议不等于已检索到真实岗位。 |
| 扫描件无法识别 | 安装 OCR 依赖并配置 Python 路径，或配置火山 OCR 与视觉模型。 |
| 语音输入不可用 | 检查浏览器支持、HTTPS / localhost 上下文及麦克风权限，可继续使用文字输入。 |

[配置与部署](configuration.md) · [文档中心](README.md)
