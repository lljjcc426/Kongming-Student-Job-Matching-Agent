# 部署指南

本文说明孔明职配的本地运行、构建验证和公开部署方式。HarmonyOS 主端采用原生 ArkTS/ArkUI；React + TypeScript + Vite 保留为 Web 产品与本地开发网关。云端可采用 Vercel API 入口，或单独的 Node.js 生产网关。

## 1. 环境要求

推荐环境：

- Node.js 24 LTS。不要使用 DevEco 内置的旧版 Node 运行 Web 构建。
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
- 可供任意用户访问、具备身份认证和费用治理的公网生产岗位与模型 API；已有仅限指定出口访问的 HTTPS 内测网关。

如需一键容器化部署，需要后续补充。

## 13. ECS 私有生产网关

`server/httpServer.js` 提供独立 HTTP 入口，默认仅监听服务器本机 `127.0.0.1:8787`，不使用 Vite，不暴露供应商配置、私有文件或额外 API 路由。

本机验证和打包：

```bash
npm run verify:gateway-http
npm run verify:gateway
npm run package:gateway
```

轻量依赖清单位于 `deploy/gateway/package.json`，只安装 `ws`。部署包按明确文件清单生成，同时检查是否意外包含本机模型凭证；不包含 `.env.local`、私人简历、工作区、岗位缓存、前端资源或 HAP。

服务器安装、非登录运行用户、systemd 开机启动和凭证目录规范见 `deploy/gateway/README.md`。

私有安装阶段不会开放公网接口。2026-09-28 已单独配置可信 IP 证书、自动续期和指定出口 `/32` 的 HTTPS 内测入口，并重新构建云端原生 HAP。部署记录与明确验收范围见 `docs/CLOUD_GATEWAY_DEPLOYMENT_20260928.md`；这不等于正式签名交付、任意用户可用或网页版云发布。

指定内测网络下可重新构建：

```powershell
npm run build:harmony:release -- -GatewayApiUrl https://121.41.44.243/api/gateway
```

多用户身份认证、费用告警和适用发布要求完成前，不能把这个受限入口改为公开的付费模型调用入口。换网络时，需要同时更新云安全组和 Nginx 的来源限制。原模拟器已保留数据覆盖安装云端包，未自动启动原进行中的面试。
