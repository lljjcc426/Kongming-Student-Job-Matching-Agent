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
AI_MODEL_PROVIDER=iflytek-spark
IFLYTEK_SPARK_APP_ID=your_iflytek_app_id
IFLYTEK_SPARK_API_KEY=your_iflytek_api_key
IFLYTEK_SPARK_API_SECRET=your_iflytek_api_secret
IFLYTEK_SPARK_MODEL=4.0Ultra
IFLYTEK_SPARK_REQUEST_TIMEOUT_MS=65000
```

继续使用 Ark/Gitee AI 兼容服务时改为：

```bash
AI_MODEL_PROVIDER=ark
ARK_API_KEY=your_model_api_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL=Qwen3-4B
ARK_VISION_MODEL=Qwen3-VL-8B-Instruct
ARK_PACKAGE=1492
ARK_REQUEST_TIMEOUT_MS=65000
```

可选配置：

```bash
VITE_AVATAR_MODE=static
PUBLIC_APP_ORIGINS=https://your-frontend.example
```

注意：

- 不要提交 `.env.local`。
- 不要在 README、Issue、日志或截图中暴露真实 Key。
- 当前仓库提供 `.env.example` 占位模板，不包含真实密钥。

### 模型服务说明

当前 `server/modelProvider.js` 负责选择讯飞星火或原 Ark/Gitee AI 兼容服务，`server/arkCore.js` 统一构建任务提示，再按配置调用星火 HMAC WebSocket、星火 OpenAI 兼容 HTTP 或原兼容接口。客户端只调用 `/api/gateway`，由 `server/publicGateway.js` 分流岗位、状态和模型任务并统一执行来源校验、限流与错误脱敏；客户端不接触供应商端点或密钥。星火详细配置见 `docs/IFLYTEK_SPARK_INTEGRATION.md`；既有 Gitee AI 真实调用证据见 `docs/REAL_MODEL_CALL_EVIDENCE.md`。

## 4. 本地运行

启动开发服务器：

```bash
npm run dev
```

Vite 会输出本地访问地址，通常为：

```text
http://localhost:5173
```

开发环境中，`vite.config.ts` 只挂载 `/api/gateway`，并复用生产环境的 `server/publicGateway.js` 访问控制和响应协议。

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

当前仓库提供分层验证脚本：

```bash
npm run verify:parsers
npm run verify:evidence
npm run verify:jobs
npm run verify:job-sources
npm run verify:harmony
npm run verify:claims
npm run verify:core
```

`verify:core` 汇总解析、证据约束、岗位来源、Harmony 工程和旧评分退出检查。`verify:evidence` 包含 20 组虚构事实对抗样例、工作区恢复、简历版本和投递绑定测试。

```bash
npm run verify:ui
```

用途：

- 使用 Playwright 验证核心 UI 流程。
- 脚本会按 `operation` Mock `/api/gateway`，覆盖隐私门禁、简历确认、版本保存、投递绑定、刷新恢复、模拟面试和 AI 助手页面。
- Mock 测试通过不表示生产岗位或模型服务已上线。

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

当前仓库的生产 API 入口只有 `api/gateway.js`；`vite.config.ts` 在本地提供相同协议。供应商调用、岗位采集和模型健康信息都位于 `server/`，不作为独立公网路由部署。

适合部署到 Vercel。

建议配置：

| 项 | 配置 |
| --- | --- |
| Framework Preset | Vite |
| Install Command | `npm install` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| API Routes | `api/gateway.js` |

部署平台环境变量：

```text
AI_MODEL_PROVIDER=iflytek-spark
IFLYTEK_SPARK_APP_ID=your_iflytek_app_id
IFLYTEK_SPARK_API_KEY=your_iflytek_api_key
IFLYTEK_SPARK_API_SECRET=your_iflytek_api_secret
IFLYTEK_SPARK_MODEL=4.0Ultra
PUBLIC_APP_ORIGINS=https://your-frontend.example
```

或继续配置兼容服务：

```text
ARK_API_KEY=your_model_api_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_REQUEST_TIMEOUT_MS=65000
```

## 8. 生产环境验证路径

部署后建议按以下顺序验证：

1. 打开首页，确认加载页和主页面正常显示。
2. 进入简历解析页面，上传文本简历。
3. 确认待确认学生画像、三类岗位页签、硬性条件和要求证据矩阵生成。
4. 输入目标 JD，确认 JD 分析结果生成。
5. 下载 Markdown 分析报告。
6. 进入模拟面试页面，验证问题生成、文本回答和反馈。
7. 进入 AI 助手页面，验证多轮问答。
8. 检查部署平台日志中是否出现模型请求错误。
9. 请求 `/api/gateway?operation=status`，确认岗位与模型配置状态符合预期。

## 9. HarmonyOS 安装包

本机模拟器联调：

```powershell
npm run dev -- --port 5173 --strictPort
npm run build:harmony:local
npm run run:harmony:emulator
```

本地调试 HAP 使用模拟器宿主网关 `http://10.0.2.2:5173/api/gateway`。源码中的 `gateway_service_url` 保持为空，构建脚本只在 D 盘 staging 工程中注入地址；未配置或服务不可用时，原生岗位页保留本机真实岗位录入。

正式 HAP 必须使用公网 HTTPS API：

```powershell
npm run build:harmony:release -- `
  -PublicApiBaseUrl https://your-domain.example
```

发布构建会拒绝非 HTTPS 地址。当前仓库没有签名证书和 Profile，生成的是 unsigned 调试 HAP；签名、App ID、包名和华为账号指纹需要在团队开发者账号下配置。

当前模拟器构建、安装和原生 OCR 文件选择证据见 `docs/RELEASE_EVIDENCE_20260920.md`；7 月报告仍作为历史基线保留。

## 10. 常见问题

### 模型服务不可用

表现：

```text
当前运行环境未配置讯飞星火 APIPassword，或完整的 APPID/APIKey/APISecret，模型能力不可用。
```

处理：

- 检查本地 `.env.local` 或部署平台环境变量。
- 星火模式确认 `AI_MODEL_PROVIDER=iflytek-spark`，并配置 `IFLYTEK_SPARK_API_PASSWORD`，或完整的 `IFLYTEK_SPARK_APP_ID/API_KEY/API_SECRET`；模型名必须与账号实际开通能力一致。
- Ark 兼容模式确认 `AI_MODEL_PROVIDER=ark` 与 `ARK_API_KEY`。
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

## 11. 敏感信息配置方式

- 本地使用 `.env.local` 保存密钥。
- Vercel 使用 Project Settings 中的 Environment Variables。
- 不要在 Git 仓库、截图、运行日志或演示视频中公开真实密钥。
- 真实调用日志公开前必须脱敏。

## 12. 当前未提供的部署能力

当前仓库未提供：

- Dockerfile。
- docker-compose.yml。
- GitHub Actions 或其他 CI 配置。
- 数据库部署配置。
- 对象存储配置。
- 正式 HarmonyOS 签名配置。
- 已部署的公网生产岗位与模型 API。

如需一键容器化部署，需要后续补充。
