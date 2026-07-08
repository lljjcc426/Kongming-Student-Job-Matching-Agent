# 部署指南

本文说明 Kongming Student Job Matching Agent 的本地运行、构建验证和公开部署方式。当前项目是 React + TypeScript + Vite 应用，并包含 Vercel API 入口。

## 1. 环境要求

推荐环境：

- Node.js 20 或更新版本。
- npm。
- 可访问 npm registry 的网络环境。
- 如需真实模型能力，需要可用的模型服务 API Key。

当前仓库没有 Python、Go、Java、Docker 或数据库依赖。

## 2. 依赖安装

在仓库根目录执行：

```bash
npm install
```

依赖来源：

- `package.json`
- `package-lock.json`

## 3. 配置准备

### 本地模型配置

如需启用真实模型能力，在本地创建 `.env.local`：

```bash
ARK_API_KEY=your_model_api_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL=Qwen3-4B
ARK_VISION_MODEL=Qwen3-VL-8B-Instruct
ARK_PACKAGE=1492
ARK_REQUEST_TIMEOUT_MS=65000
```

可选配置：

```bash
VITE_ARK_API_URL=/api/ark
VITE_AVATAR_MODE=static
```

注意：

- 不要提交 `.env.local`。
- 不要在 README、Issue、日志或截图中暴露真实 Key。
- 当前仓库提供 `.env.example` 占位模板，不包含真实密钥。

### 模型服务说明

当前 `server/arkCore.js` 按 OpenAI 兼容的 `chat/completions` 接口调用模型，并已完成 Gitee AI / 沐曦 Token 资源包适配。配置 `ARK_BASE_URL=https://ai.gitee.com/v1`、`ARK_PACKAGE=1492`、`ARK_MODEL=Qwen3-4B`、`ARK_VISION_MODEL=Qwen3-VL-8B-Instruct` 后，可通过 `/api/ark` 完成真实模型调用。真实调用证据见 `docs/REAL_MODEL_CALL_EVIDENCE.md`。

## 4. 本地运行

启动开发服务器：

```bash
npm run dev
```

Vite 会输出本地访问地址，通常为：

```text
http://localhost:5173
```

开发环境中，`vite.config.ts` 会挂载 `/api/ark` 代理，直接调用 `server/arkCore.js`。

## 5. 构建验证

执行：

```bash
npm run build
```

该命令会先执行 TypeScript 构建检查，再执行 Vite 构建。构建产物默认输出到：

```text
dist/
```

预览构建产物：

```bash
npm run preview
```

## 6. 测试验证

当前仓库提供两个验证脚本：

```bash
npm run verify:parsers
```

用途：

- 验证模型返回 JSON 带尾随文本时，简历解析器和岗位解析器仍能处理。

```bash
npm run verify:ui
```

用途：

- 使用 Playwright 验证核心 UI 流程。
- 脚本会 Mock `/api/ark`，覆盖简历上传、岗位推荐、模拟面试入口和 AI 助手页面。

运行 `verify:ui` 前需要先启动本地开发服务器：

```bash
npm run dev
```

然后在另一个终端执行：

```bash
npm run verify:ui
```

脚本会输出截图到 `artifacts/`。该目录已被 `.gitignore` 排除，如需公开截图，应复制脱敏后的截图到文档指定目录或单独提供。

## 7. Vercel 部署建议

当前仓库包含：

- `api/ark.js`
- `vercel.json`
- `vite.config.ts`

适合部署到 Vercel。

建议配置：

| 项 | 配置 |
| --- | --- |
| Framework Preset | Vite |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| API Route | `api/ark.js` |

部署平台环境变量：

```text
ARK_API_KEY=your_model_api_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_REQUEST_TIMEOUT_MS=65000
```

## 8. 生产环境验证路径

部署后建议按以下顺序验证：

1. 打开首页，确认加载页和主页面正常显示。
2. 进入简历解析页面，上传文本简历。
3. 确认学生画像、岗位推荐和匹配评分生成。
4. 输入目标 JD，确认 JD 分析结果生成。
5. 下载 Markdown 分析报告。
6. 进入模拟面试页面，验证问题生成、文本回答和反馈。
7. 进入 AI 助手页面，验证多轮问答。
8. 检查部署平台日志中是否出现模型请求错误。

## 9. 常见问题

### 模型服务不可用

表现：

```text
当前运行环境未配置 ARK_API_KEY，模型能力不可用。
```

处理：

- 检查本地 `.env.local` 或部署平台环境变量。
- 确认变量名为 `ARK_API_KEY`。
- 确认服务重启后重新读取环境变量。

### PDF 识别不完整

处理：

- 优先上传可复制文字的 PDF。
- 如果 PDF 文本层质量低，系统会尝试视觉识别。
- 文件大小不能超过前端上传限制。

### Playwright 验证失败

处理：

- 确认 `npm run dev` 已运行。
- 确认本地端口为 `5173`。
- 确认浏览器依赖可用。

### Live2D 面试官不显示

处理：

- 页面会自动回退到 PNG 面试官。
- 检查 `public/avatars/interviewer-live2d/` 下模型文件是否完整。
- 检查 `public/vendor/live2d/live2dcubismcore.min.js` 是否可访问。

## 10. 敏感信息配置方式

- 本地使用 `.env.local` 保存密钥。
- Vercel 使用 Project Settings 中的 Environment Variables。
- 不要在 Git 仓库、截图、运行日志或演示视频中公开真实密钥。
- 真实调用日志公开前必须脱敏。

## 11. 当前未提供的部署能力

当前仓库未提供：

- Dockerfile。
- docker-compose.yml。
- GitHub Actions 或其他 CI 配置。
- 数据库部署配置。
- 对象存储配置。

如需一键容器化部署，需要后续补充。
